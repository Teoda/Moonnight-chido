-- CreateTable
CREATE TABLE `horario_personal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `diaSemana` INTEGER NOT NULL,
    `turno` INTEGER NOT NULL,
    `area` ENUM('PLANTA_BAJA', 'SALAS') NOT NULL,
    `usuarioId` INTEGER NOT NULL,

    INDEX `horario_personal_usuarioId_idx`(`usuarioId`),
    UNIQUE INDEX `horario_personal_diaSemana_turno_area_key`(`diaSemana`, `turno`, `area`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `horario_personal` ADD CONSTRAINT `horario_personal_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
