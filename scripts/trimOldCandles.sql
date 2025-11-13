-- 🧹 Elimina velas antiguas dejando solo las 300 más recientes por activo y temporalidad

DELETE FROM "Candle"
WHERE ("valueId", "timeframe", "time") NOT IN (
  SELECT "valueId", "timeframe", "time"
  FROM (
    SELECT 
      "valueId",
      "timeframe",
      "time",
      ROW_NUMBER() OVER (PARTITION BY "valueId", "timeframe" ORDER BY "time" DESC) AS rn
    FROM "Candle"
  ) sub
  WHERE rn <= 300
);
