-- Solo desarrollo: Prisma Migrate necesita crear una "shadow database".
GRANT ALL PRIVILEGES ON *.* TO 'moonlight'@'%';
FLUSH PRIVILEGES;
