-- 003_city_state: give every city its state, so the two dropdowns can cascade.
--
-- Without this the City and State fields are independent, and a candidate can
-- save "Pune" with "Kerala" — which quietly corrupts the location data Phase 2
-- scores on, and looks broken to anyone filling the form.
--
-- Nullable because the column is added to a populated table; the seed fills it
-- immediately afterwards. The "Other" row keeps a NULL state on purpose: it is
-- offered in every state.

ALTER TABLE city ADD COLUMN state TEXT;

CREATE INDEX idx_city_state ON city (state, sort_order);
