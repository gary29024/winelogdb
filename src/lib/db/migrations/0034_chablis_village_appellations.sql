-- 0032 read the cru tier off the place tree, which at the time filed Chablis as
-- a container for its own pyramid rather than as the village AOC in the middle
-- of it, and left the Côte Chalonnaise and Mâconnais villages unmarked. Wines
-- already logged under those names kept a NULL tier, so this fills them in.
--
-- Only where nothing has been decided: a NULL classification alongside a
-- classification_override is a tier cleared by hand, and this must not undo it.

UPDATE wines SET classification='village'
  WHERE classification IS NULL AND classification_override IS NULL
  AND appellation IN ('Chablis','Mercurey','Givry','Rully','Montagny','Bouzeron',
    'Pouilly-Fuissé','Saint-Véran','Viré-Clessé');

-- Chablis Premier Cru is its own AOC, unlike every other Burgundian premier cru,
-- which is a climat inside a village appellation and read off the label instead.
UPDATE wines SET classification='premier_cru'
  WHERE classification IS NULL AND classification_override IS NULL
  AND appellation='Chablis Premier Cru';
