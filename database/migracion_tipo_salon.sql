ALTER TABLE `clases`
  ADD COLUMN `tipo_salon` enum('normal','reunion','griego')
  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal'
  AFTER `nombre_docente`;
