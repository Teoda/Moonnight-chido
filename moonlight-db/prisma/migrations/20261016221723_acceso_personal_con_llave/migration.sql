-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `llaveHash` VARCHAR(100) NULL,
    MODIFY `email` VARCHAR(150) NULL,
    MODIFY `passwordHash` VARCHAR(100) NULL;
