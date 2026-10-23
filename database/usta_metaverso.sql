-- MySQL dump 10.13  Distrib 26.7.0, for Win64 (x86_64)
--
-- Host: localhost    Database: usta_metaverso
-- ------------------------------------------------------
-- Server version	26.7.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `clases`
--

DROP TABLE IF EXISTS `clases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `materia` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correo_docente` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_docente` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_creacion` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `correo_docente` (`correo_docente`),
  CONSTRAINT `clases_ibfk_1` FOREIGN KEY (`correo_docente`) REFERENCES `cuentas` (`correo`)
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clases`
--

LOCK TABLES `clases` WRITE;
/*!40000 ALTER TABLE `clases` DISABLE KEYS */;
INSERT INTO `clases` VALUES (1,'CAL-634','Calculo 2','rafael@usantoto.edu.co','Rafel Diaz','2026-08-23 18:56:48'),(2,'CAL-997','Cal 3','rafael@usantoto.edu.co','rafael diaz','2026-08-23 20:33:36'),(3,'POO-219','poo','rafael@usantoto.edu.co','rafael diaz','2026-08-24 10:33:45'),(4,'BD-942','BD','rafael@usantoto.edu.co','Rafel Diaz','2026-08-24 14:29:28'),(5,'CAL-668','Calculo 2','admin.ramirez@usantoto.edu.co','agel ramirez','2026-08-24 17:34:30'),(6,'REU-603','Reunion','admin.ramirez@usantoto.edu.co','agel ramirez','2026-08-26 15:43:30'),(7,'INT-176','Introduccion Medicina','manuel@usantoto.edu.co','Manuel','2026-08-26 15:53:49'),(8,'ABC-255','abc','profesor.jose@usantoto.edu.co','jose jose','2026-08-26 16:15:52'),(9,'X L-400','x lab 2','admin.ramirez@usantoto.edu.co','Angel Ramirez','2026-08-28 09:42:25'),(10,'REU-175','Reunion 2','admin.ramirez@usantoto.edu.co','Angel Ramirez','2026-09-14 17:38:46'),(11,'CIB-650','Ciber_A','admin.ramirez@usantoto.edu.co','Angel Ramirez','2026-09-29 16:30:12'),(12,'PRU-581','Prueba','admin.valentina@usantoto.edu.co','Valentina Torres','2026-10-02 15:08:51'),(13,'ING-242','INGLES 5','dora.rodriguez@usantoto.edu.co','Dora Rodriguez','2026-10-02 20:48:25'),(14,'FIL-877','filosofia Arq','admin.ramirez@usantoto.edu.co','Angel Ramirez','2026-10-08 14:54:55'),(65,'PIT-201','Pitagoras','admin.ramirez@usantoto.edu.co','Angel Ramirez','2026-10-09 15:21:28');
/*!40000 ALTER TABLE `clases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cuentas`
--

DROP TABLE IF EXISTS `cuentas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cuentas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_completo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contrasena_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol` enum('estudiante','docente','admin','invitado') COLLATE utf8mb4_unicode_ci NOT NULL,
  `carrera` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `materia` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto` mediumtext COLLATE utf8mb4_unicode_ci,
  `fecha_creacion` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo` (`correo`)
) ENGINE=InnoDB AUTO_INCREMENT=126 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cuentas`
--

LOCK TABLES `cuentas` WRITE;
/*!40000 ALTER TABLE `cuentas` DISABLE KEYS */;
INSERT INTO `cuentas` VALUES (4,'Manuel','manuel@usantoto.edu.co','$2b$10$CKldj2.px9WC57x25MIEeeMDCQ0awb/xd7C4eJ5n9bdom5IluZRFa','docente',NULL,'Medicina',NULL,'2026-08-23 18:30:49'),(5,'Rafel Diaz','rafael@usantoto.edu.co','$2b$10$Z.S4CyCKKdBSlfkNDKs.DulG9AoYT8UAfSteGpCXUK8y7sS2CsbR6','docente',NULL,'Vectorial',NULL,'2026-08-23 18:34:29'),(6,'Dora Rodriguez','dora.rodriguez@usantoto.edu.co','$2b$10$t9yhqJnCvRUAcGBpILTkmuJG.BhtaUZRZW3S0R/SLErpkIdnqUoyO','docente','Idiomas',NULL,NULL,'2026-08-24 15:46:53'),(7,'Nicolás Diaz Rosriguez','profesor.nicolas@usantoto.edu.co','$2b$10$jx6XCEZ7FwaKd7GCmGbIH.wt0iJ7Mi4SICntgyzJiqTPxEhDm2XMC','docente',NULL,'Desarrollo de Videojuegos',NULL,'2026-08-24 15:54:18'),(8,'jose jose','profesor.jose@usantoto.edu.co','$2b$10$UaoVPGvEw4.7cZyMB17wuutZTGpt5Hr8tTaVJaYPt..3ePwTKIOlq','docente',NULL,'Derecho',NULL,'2026-08-24 15:55:38'),(9,'Miguel Bose','profesor.miguel@usantoto.edu.co','$2b$10$NJTj.IrT/haO/MolnTH3i.767LBuH3kuzgzmq8vif0gDt7kuaLoci','docente',NULL,'Dibujo tecnico',NULL,'2026-08-24 16:00:51'),(10,'Michael Jackson','michael.jackson@usantoto.edu.co','$2b$10$LcPUKj6tyIIJP5tLBIhY4uW1G6vWSSZY/KN..f2tHesgHdnFgJe2q','estudiante','Ing Ambiental',NULL,NULL,'2026-08-24 16:01:44'),(11,'Diomedes Diaz','diomedes01@gmail.com','$2b$10$.7DTvOYkKJLubPdKBSFGrOgs620QGFNYjNhxE247VeodY7dOGzgv6','estudiante','Invitado',NULL,NULL,'2026-08-24 16:02:17'),(12,'Angel Ramirez','admin.ramirez@usantoto.edu.co','$2b$10$7wn2a3ig/8xGzVQvDS/Gb.KB7ql8yL2FnfOIvOaBaOZsAsPQ/fKqC','admin',NULL,NULL,NULL,'2026-08-24 17:33:32'),(13,'Augusto Diaz Rodriguez','augusto@usantoto.edu.co','$2b$10$z83QXetx3rGkWOKynWYOT.3ueZLiDP4f79S5P/8ZwuBeDMFMnoJpK','estudiante','ING Sistemas',NULL,NULL,'2026-09-14 14:11:50'),(14,'Augusto Rodriguez','profe.augusto@usantoto.edu.co','$2b$10$14lej96AUdqMIupk1alehugBv4eTv8Qr2NLW2zG58Z2hBUFsvuZzi','docente',NULL,'Programacion Orientada Objetos',NULL,'2026-09-14 17:15:08'),(15,'Prueba Camara','prueba.metaverso.camara@usantoto.edu.co','$2b$10$YxOQ6a5AH84nnkvj8aj.CerU/e39KkTfJYAQAsOvWAvVcSZY5oppS','estudiante','Sistemas',NULL,NULL,'2026-09-21 15:58:42'),(66,'Fredy Borda','fredy.borda@usantoto.edu.co','$2b$10$7taNpFWpQ8078mzdYhzgGef7Y7BkDKA/ANQWFMAbgUODMgvS20jI6','estudiante','Ing Sistemas',NULL,NULL,'2026-09-29 16:36:36'),(68,'Valentina Torres','admin.valentina@usantoto.edu.co','$2b$10$7wn2a3ig/8xGzVQvDS/Gb.KB7ql8yL2FnfOIvOaBaOZsAsPQ/fKqC','admin',NULL,NULL,NULL,'2026-10-02 14:15:33'),(69,'Laura Gomez','profe.laura@usantoto.edu.co','$2b$10$8faeGfuhmCMZzt.juGHdh.4uBczt9AJjent0OrHRf6XJJhTMltsrm','docente',NULL,'Matematicas',NULL,'2026-10-02 14:15:33'),(70,'Valentina Rojas','valentina@usantoto.edu.co','$2b$10$8faeGfuhmCMZzt.juGHdh.4uBczt9AJjent0OrHRf6XJJhTMltsrm','estudiante','Ing Sistemas',NULL,NULL,'2026-10-02 14:15:33'),(71,'Prueba','admin.prueba@usantoto.edu.co','$2b$10$7wn2a3ig/8xGzVQvDS/Gb.KB7ql8yL2FnfOIvOaBaOZsAsPQ/fKqC','admin',NULL,NULL,NULL,'2026-10-09 00:07:16'),(124,'Manuel','manuel.rr@usantoto.edu.co','$2b$10$aQjTaBv6HLraz6jNajdHB.FHXZ3UWvs/dR3q/bvG8Xye3gUVJwr2K','estudiante','Medicina',NULL,NULL,'2026-10-09 15:19:23'),(125,'Administrador','admin@usantoto.edu.co','$2b$10$4Tkm36Ywd8Z98aWhH5yVYeM9EtIDF.4rf/hkSGaOCjx4mSWwfYjHa','admin',NULL,NULL,NULL,'2026-10-23 10:51:16');
/*!40000 ALTER TABLE `cuentas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inscripciones`
--

DROP TABLE IF EXISTS `inscripciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inscripciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo_clase` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `correo_estudiante` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_inscripcion` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unica_inscripcion` (`codigo_clase`,`correo_estudiante`),
  KEY `correo_estudiante` (`correo_estudiante`),
  CONSTRAINT `inscripciones_ibfk_1` FOREIGN KEY (`codigo_clase`) REFERENCES `clases` (`codigo`),
  CONSTRAINT `inscripciones_ibfk_2` FOREIGN KEY (`correo_estudiante`) REFERENCES `cuentas` (`correo`)
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inscripciones`
--

LOCK TABLES `inscripciones` WRITE;
/*!40000 ALTER TABLE `inscripciones` DISABLE KEYS */;
INSERT INTO `inscripciones` VALUES (1,'CAL-634','dora.rodriguez@usantoto.edu.co','2026-08-24 15:47:38'),(2,'POO-219','diomedes01@gmail.com','2026-08-25 11:39:41'),(3,'INT-176','michael.jackson@usantoto.edu.co','2026-08-26 15:54:36'),(4,'ABC-255','dora.rodriguez@usantoto.edu.co','2026-08-26 16:18:04'),(5,'X L-400','michael.jackson@usantoto.edu.co','2026-08-28 09:43:12'),(6,'POO-219','augusto@usantoto.edu.co','2026-09-14 14:12:01'),(7,'REU-175','augusto@usantoto.edu.co','2026-09-14 17:39:16'),(8,'REU-175','prueba.metaverso.camara@usantoto.edu.co','2026-09-21 15:58:42'),(59,'CAL-634','fredy.borda@usantoto.edu.co','2026-09-29 16:36:59'),(60,'CIB-650','augusto@usantoto.edu.co','2026-09-30 17:16:06'),(61,'PRU-581','augusto@usantoto.edu.co','2026-10-02 15:09:33'),(62,'FIL-877','augusto@usantoto.edu.co','2026-10-08 14:55:25'),(113,'PIT-201','augusto@usantoto.edu.co','2026-10-09 15:22:50'),(114,'PIT-201','manuel.rr@usantoto.edu.co','2026-10-09 15:23:13'),(115,'PIT-201','valentina@usantoto.edu.co','2026-10-09 15:23:51');
/*!40000 ALTER TABLE `inscripciones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'usta_metaverso'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-23 11:07:26
