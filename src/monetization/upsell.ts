import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

export async function checkUpsellTrigger(userId: number, callCount: number) {
  if (callCount >= 5) {
    const { data, error } = await db.from('upsell_triggers').insert({
      user_id: userId,
      trigger_type: 'free_call_5',
      shown_at: new Date(),
      converted: false,
    }).select();

    if (error) {
      console.error(error);
    } else {
      return true;
    }
  }
  return false;
}

export async function getUpsellPrompt(userId: number) {
  const { data, error } = await db.from('users').select('id, calls_made').eq('id', userId);
  if (error) {
    console.error(error);
    return '';
  }

  const usagePercentage = (data[0].calls_made / 10) * 100;
  const promptVariants = [
    `You've reached ${usagePercentage}% of your free calls! Upgrade now to avoid interruptions.`,
    `You're getting close to using up all your free calls! Consider upgrading to a paid plan.`,
  ];

  return promptVariants[Math.floor(Math.random() * promptVariants.length)];
}

export async function setUpsellHeader(userId: number, callCount: number) {
  const trigger = await checkUpsellTrigger(userId, callCount);
  if (trigger) {
    return { 'X-Upsell-Prompt': 'true' };
  }
  return {};
}
