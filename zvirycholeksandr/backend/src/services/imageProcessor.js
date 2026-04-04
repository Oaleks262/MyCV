/**
 * Конвертує завантажений файл у WebP та видаляє оригінал.
 * Повертає нове ім'я файлу (з .webp).
 * Якщо sharp не встановлений — повертає оригінальне ім'я (graceful fallback).
 */
const path = require('path');
const fs   = require('fs');

async function convertToWebP(file) {
  let sharp;
  try { sharp = require('sharp'); } catch {
    return file.filename; // sharp не встановлений — пропускаємо
  }

  const inputPath  = file.path;
  const newName    = `${path.basename(file.filename, path.extname(file.filename))}.webp`;
  const outputPath = path.join(path.dirname(inputPath), newName);

  await sharp(inputPath)
    .webp({ quality: 82 })
    .toFile(outputPath);

  fs.unlinkSync(inputPath); // видаляємо оригінал

  // Оновлюємо об'єкт file in-place щоб маршрут бачив нові дані
  file.filename = newName;
  file.path     = outputPath;
  file.mimetype = 'image/webp';

  return newName;
}

module.exports = { convertToWebP };
