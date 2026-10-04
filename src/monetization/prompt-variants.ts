/**
 * Prompt Variants for A/B Testing — Issue #3
 * Manages upsell prompt strategies for maximum conversion
 */

export interface PromptVariant {
  id: string;
  text: string;
  cta: string;
  description: string;
  psychologyStrategy: string;
}

export enum VariantSelectionStrategy {
  RANDOM = 'random',
  USER_ID_HASH = 'user_id_hash',
  BEST_PERFORMER = 'best_performer'
}

export const PROMPT_VARIANTS: Record<string, PromptVariant> = {
  variant_a_scarcity: {
    id: 'variant_a_scarcity',
    text: 'You\'ve used 50% of your free calls! 🔥 Upgrade now to unlock unlimited access and stay competitive.',
    cta: 'Upgrade to Pro',
    description: 'Scarcity-focused messaging',
    psychologyStrategy: 'Loss aversion + FOMO'
  },

  variant_b_value: {
    id: 'variant_b_value',
    text: 'Half your free calls gone already! 📊 Pro users get 10x more volume. Unlock unlimited calls for just $9.99/month.',
    cta: 'See Pricing',
    description: 'ROI-focused messaging',
    psychologyStrategy: 'Rational benefit + price anchoring'
  },

  variant_c_social: {
    id: 'variant_c_social',
    text: '50% of free calls used. 🚀 Join 10,000+ developers who upgraded to Pro for unlimited API access.',
    cta: 'Become Pro',
    description: 'Social proof-focused messaging',
    psychologyStrategy: 'Social proof + bandwagon effect'
  },

  variant_d_ease: {
    id: 'variant_d_ease',
    text: 'Only 5 free calls left. Want to keep going? Upgrade instantly with one click—no hassle, instant access.',
    cta: 'Continue Unlimited',
    description: 'Friction minimization approach',
    psychologyStrategy: 'Reduction of perceived friction'
  },

  variant_e_progress: {
    id: 'variant_e_progress',
    text: 'Great job! You\'ve already used 50% of your free quota. Upgrade now and unlock the full power of our API.',
    cta: 'Unlock Full Power',
    description: 'Progress/achievement-focused messaging',
    psychologyStrategy: 'Achievement + momentum'
  }
};

export function selectVariant(
  userId: string,
  strategy: VariantSelectionStrategy = VariantSelectionStrategy.USER_ID_HASH
): PromptVariant {
  const variants = Object.values(PROMPT_VARIANTS);

  switch (strategy) {
    case VariantSelectionStrategy.RANDOM:
      return variants[Math.floor(Math.random() * variants.length)];

    case VariantSelectionStrategy.USER_ID_HASH:
      const hash = userId.split('').reduce((acc, char) => {
        return (acc << 5) - acc + char.charCodeAt(0);
      }, 0);
      return variants[Math.abs(hash) % variants.length];

    default:
      return variants[0];
  }
}
