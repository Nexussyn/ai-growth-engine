import { upsellMiddleware } from '../src/monetization/upsell';
import { db } from '../src/db'; // Assuming db is your database client

describe('Upsell Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'test-user-id' } };
    res = { setHeader: jest.fn(), locals: {} };
    next = jest.fn();
  });

  afterEach(async () => {
    await db.query('DELETE FROM user_calls WHERE user_id = $1', [req.user.id]);
    await db.query('DELETE FROM upsell_triggers WHERE user_id = $1', [req.user.id]);
  });

  it('should set X-Upsell-Prompt header and locals.upsellPrompt when call count reaches 5', async () => {
    for (let i = 0; i < 5; i++) {
      await db.query('INSERT INTO user_calls (user_id) VALUES ($1)', [req.user.id]);
    }
    
    await upsellMiddleware(req, res, next);
    
    expect(res.setHeader).toHaveBeenCalledWith('X-Upsell-Prompt', 'true');
    expect(res.locals.upsellPrompt).toBeDefined();
  });

  it('should not set X-Upsell-Prompt header if trigger already exists', async () => {
    for (let i = 0; i < 5; i++) {
      await db.query('INSERT INTO user_calls (user_id) VALUES ($1)', [req.user.id]);
    }
    
    await db.query('INSERT INTO upsell_triggers (user_id, trigger_type) VALUES ($1, $2)', [req.user.id, 'free_limit_50']);
    
    await upsellMiddleware(req, res, next);
    
    expect(res.setHeader).not.toHaveBeenCalledWith('X-Upsell-Prompt', 'true');
  });
});