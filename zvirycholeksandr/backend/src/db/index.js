const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');

function readFile(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeFile(filename, data) {
  const filepath = path.join(DATA_DIR, filename);
  const tmp = filepath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filepath);
}

class JsonDB {
  constructor(filename) {
    this.filename = filename;
    const filepath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filepath)) writeFile(filename, []);
  }

  all(filter = {}) {
    const data = readFile(this.filename);
    if (!Object.keys(filter).length) return data;
    return data.filter(i =>
      Object.entries(filter).every(([k, v]) => i[k] === v)
    );
  }

  findById(id) {
    return readFile(this.filename).find(i => i.id === id) || null;
  }

  findOne(filter) {
    return readFile(this.filename).find(i =>
      Object.entries(filter).every(([k, v]) => i[k] === v)
    ) || null;
  }

  insert(data) {
    const list = readFile(this.filename);
    const record = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...data
    };
    list.push(record);
    writeFile(this.filename, list);
    return record;
  }

  update(id, updates) {
    const list = readFile(this.filename);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeFile(this.filename, list);
    return list[idx];
  }

  delete(id) {
    const list = readFile(this.filename);
    writeFile(this.filename, list.filter(i => i.id !== id));
  }
}

module.exports = JsonDB;
