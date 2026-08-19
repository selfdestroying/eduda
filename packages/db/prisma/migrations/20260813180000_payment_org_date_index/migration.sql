-- Список оплат школы отбирает период и сортирует по дате. Индекса по одному
-- organizationId для этого мало: под него попадают все оплаты школы, и порядок
-- приходится строить заново на каждый запрос.
CREATE INDEX "Payment_organizationId_date_idx" ON "Payment"("organizationId", "date");
