# Tiered API call pricing

Call counts are **one-based ordinals**, including the current call. Calls 1–50
are free, 51–500 cost 0.01 USDC, and 501 onward cost 0.03 USDC. Priority overrides
all tiers at 0.10 USDC. This preserves the existing engine, seeded pricing table,
and tests at the issue's overlapping “500+” boundary.

```ts
import { get_tier_price, getTierPrice } from '../src/pricing/tier-engine.ts';

get_tier_price(51, false); // 0.01 USDC (numeric price)
getTierPrice(51); // { tier: 'standard', pricePerCall: 0.01, callsInTier: 450 }
```

The existing `getTierPrice` and `calculateBatchCost` interfaces remain available.
Invalid call ordinals throw `RangeError`; batch lengths must be non-negative
safe integers and their ending ordinal must also be safe.

Apply `migrations/add_tiered_pricing.sql` to the application's existing
`x402_calls` payment table. The migration adds tier, price and priority columns,
seeds the four tiers, and exposes the same numeric price as a PostgreSQL function:

```sql
SELECT get_tier_price(51, FALSE); -- 0.01
```

The SQL function rejects null, non-positive, and JavaScript-unsafe ordinals;
null priority flags are rejected. Pass the call counter as a BIGINT, without
casting fractional values to integers.
Repeated migration runs preserve existing payment data and tier identities.
The application must call the helper using its trusted usage counter; no
production endpoint or billing integration is changed by this contribution.

Run the TypeScript tests with `deno test tests`. Run the database regression on
a disposable local PostgreSQL database with `psql -f tests/pricing.sql` (plus
your usual connection flags). It creates its own schema, runs the migration
twice, checks boundaries and data preservation, then rolls the transaction back.
