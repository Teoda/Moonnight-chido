ALTER USER 'moonlight'@'%' IDENTIFIED WITH mysql_native_password BY 'moonlight_pass';
GRANT ALL PRIVILEGES ON *.* TO 'moonlight'@'%';
FLUSH PRIVILEGES;