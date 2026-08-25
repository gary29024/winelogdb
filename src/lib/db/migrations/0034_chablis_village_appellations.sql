-- 0032 read the cru tier off the place tree, which at the time filed Chablis and
-- Côte de Beaune as containers for the pyramids below them rather than as the
-- village AOCs in the middle of each, left the Côte Chalonnaise and Mâconnais
-- villages unmarked, and did not carry Irancy or Saint-Bris at all. Wines
-- already logged under those names kept a NULL tier, so this fills them in.
--
-- The regional appellations added alongside them - the Hautes Côtes, Coteaux
-- Bourguignons, Crémant de Bourgogne - are deliberately absent here: they are
-- AOCs but not villages, and there is no tier to fill in.
--
-- Only where nothing has been decided: a NULL classification alongside a
-- classification_override is a tier cleared by hand, and this must not undo it.

UPDATE wines SET classification='village'
  WHERE classification IS NULL AND classification_override IS NULL
  AND appellation IN ('Chablis','Mercurey','Givry','Rully','Montagny','Bouzeron',
    'Pouilly-Fuissé','Saint-Véran','Viré-Clessé','Côte de Beaune','Irancy','Saint-Bris');

-- Chablis Premier Cru is its own AOC, unlike every other Burgundian premier cru,
-- which is a climat inside a village appellation and read off the label instead.
UPDATE wines SET classification='premier_cru'
  WHERE classification IS NULL AND classification_override IS NULL
  AND appellation='Chablis Premier Cru';
