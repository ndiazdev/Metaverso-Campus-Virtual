-- Migracion: el tipo de salon "arte" pasa a llamarse "reunion".
-- Ejecutar una sola vez en bases que ya tenian la columna tipo_salon.
-- Primero se amplia el enum para poder escribir el valor nuevo, se migran
-- las clases existentes y despues se retira el valor antiguo.

ALTER TABLE `clases`
  MODIFY COLUMN `tipo_salon` enum('normal','arte','reunion','griego')
  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal';

UPDATE `clases`
  SET `tipo_salon` = 'reunion'
  WHERE `tipo_salon` = 'arte';

ALTER TABLE `clases`
  MODIFY COLUMN `tipo_salon` enum('normal','reunion','griego')
  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal';
