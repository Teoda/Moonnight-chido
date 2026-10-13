-- CreateTable
CREATE TABLE `reportes_semanales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `desde` DATETIME(3) NOT NULL,
    `hasta` DATETIME(3) NOT NULL,
    `datos` JSON NOT NULL,
    `pdf` MEDIUMBLOB NOT NULL,
    `automatico` BOOLEAN NOT NULL DEFAULT true,
    `generadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `generadoPorId` INTEGER NULL,

    UNIQUE INDEX `reportes_semanales_desde_key`(`desde`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
