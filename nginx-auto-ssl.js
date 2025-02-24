const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SITES_DIR = "/var/www/";
const NGINX_SITES_AVAILABLE = "/etc/nginx/sites-available/";
const NGINX_SITES_ENABLED = "/etc/nginx/sites-enabled/";
const SSL_DIR = "/etc/letsencrypt/live/";

function isDomainName(name) {
    return name.includes(".") && !name.startsWith(".") && !name.endsWith(".");
}

function getDomains() {
    return fs.readdirSync(SITES_DIR).filter(folder => {
        const sitePath = path.join(SITES_DIR, folder);
        return fs.lstatSync(sitePath).isDirectory() && isDomainName(folder);
    });
}

function createNginxConfig(domain) {
    const configPath = `${NGINX_SITES_AVAILABLE}${domain}`;
    if (fs.existsSync(configPath)) return;

    console.log(`Создаю конфиг для ${domain}...`);
    const config = `
server {
    listen 80;
    server_name ${domain} www.${domain};
    root ${SITES_DIR}${domain};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}
`;
    fs.writeFileSync(configPath, config);
    execSync(`ln -sf ${configPath} ${NGINX_SITES_ENABLED}${domain}`);
}

function hasSSL(domain) {
    return fs.existsSync(`${SSL_DIR}${domain}`);
}

function issueSSL(domain) {
    if (hasSSL(domain)) {
        console.log(`SSL уже установлен для ${domain}, пропускаем.`);
        return;
    }

    console.log(`Запрашиваю SSL для ${domain}...`);
    try {
        execSync(`sudo certbot --nginx -d ${domain} -d www.${domain} --non-interactive --agree-tos -m your-email@example.com`);
        console.log(`Сертификат для ${domain} успешно выдан!`);
    } catch (error) {
        console.error(`Ошибка при выдаче сертификата для ${domain}. Повторим позже.`);
    }
}

function restartNginx() {
    execSync("sudo systemctl reload nginx");
}

// Основной процесс
getDomains().forEach(domain => {
    createNginxConfig(domain);
    restartNginx();
    issueSSL(domain);
});

console.log("Готово! Все сайты обработаны.");
