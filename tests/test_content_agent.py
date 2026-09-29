import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src' / 'agents'))
import unittest
from unittest.mock import Mock, MagicMock
from content_agent import ContentAgent,validate,SupabaseStore
import json
from urllib.error import HTTPError

def output():
    return {'tweet':'A verified change is ready for review.',
            'thread':[f'Part {i}: technical details.' for i in range(5)],
            'blog_post':' '.join(['word']*300)}

class Tests(unittest.TestCase):
    def setUp(self):
        self.store=Mock();self.store.get_bounty.return_value={'execution_status':'done','title':'Fix CSV parsing','description':'scope','outcome':'tests passed'}
        self.llm=Mock(return_value=output());self.agent=ContentAgent(self.store,self.llm)
    def test_one_call_and_exact_saved_output(self):
        result=self.agent.generate_content('123')
        self.llm.assert_called_once();self.store.save_content.assert_called_once_with('123',result)
        self.assertIn('Fix CSV parsing',self.llm.call_args.args[0])
    def test_not_done_cannot_generate(self):
        self.store.get_bounty.return_value={'execution_status':'pending'}
        with self.assertRaises(ValueError):self.agent.generate_content('123')
        self.llm.assert_not_called()
    def test_invalid_output_not_saved(self):
        self.llm.return_value={'tweet':'x'*281,'thread':[],'blog_post':''}
        with self.assertRaises(ValueError):self.agent.generate_content('123')
        self.store.save_content.assert_not_called()
    def test_save_failure_is_not_success(self):
        self.store.save_content.side_effect=RuntimeError('DB unavailable')
        with self.assertRaises(RuntimeError):self.agent.generate_content('123')
    def test_missing_bounty(self):
        self.store.get_bounty.return_value=None
        with self.assertRaises(ValueError):self.agent.generate_content('123')
    def test_bad_thread_and_length(self):
        for changes in ({'thread':['same']*5},{'blog_post':'short'},{'thread':['x']*4}):
            with self.assertRaises(ValueError):validate(output()|changes)
    def test_postgrest_schema_and_insert(self):
        opener=MagicMock();response=opener.return_value.__enter__.return_value
        response.read.return_value=json.dumps([{'title':'Fix','scope':'CSV','execution_status':'done'}]).encode()
        store=SupabaseStore('https://example.invalid','test-only',opener)
        self.assertEqual(store.get_bounty('id')['description'],'CSV')
        self.assertIn('/bounty_tasks?',opener.call_args.args[0].full_url)
        response.read.return_value=b''
        store.save_content('id',output())
        request=opener.call_args.args[0]
        self.assertTrue(request.full_url.endswith('/outreach_sent'))
        self.assertEqual(json.loads(json.loads(request.data)['content']),output())
    def test_database_http_failure_propagates(self):
        opener=Mock(side_effect=HTTPError('https://example.invalid',403,'Forbidden',{},None))
        with self.assertRaises(HTTPError):SupabaseStore('https://example.invalid','test-only',opener).save_content('id',output())

if __name__=='__main__':unittest.main()
