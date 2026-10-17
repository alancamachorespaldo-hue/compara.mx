#!/usr/bin/env node
/**
 * extraer-celulares.js — Extrae datos de celulares/android/ y celulares/iphone/
 * y los agrega a merged-admin.json bajo las categorías celulares_android y celulares_iphone.
 * Uso: node scripts/extraer-celulares.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN_PATH = resolve(ROOT, 'scripts/merged-admin.json');

function extractFamilias(html) {
  // Encuentra 'const familias = [' y extrae hasta el '];' que cierra el array
  const start = html.indexOf('const familias = [');
  if (start === -1) throw new Error('No encontré const familias');
  const arrStart = html.indexOf('[', start);
  // Busca el cierre del array contando brackets
  let depth = 0, i = arrStart;
  while (i < html.length) {
    const ch = html[i];
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') { depth--; if (depth === 0) break; }
    else if (ch === '"' || ch === "'" || ch === '`') {
      // Saltar strings
      const q = ch;
      i++;
      while (i < html.length) {
        if (html[i] === '\\') { i += 2; continue; }
        if (html[i] === q) break;
        i++;
      }
    }
    i++;
  }
  const arrText = html.slice(arrStart, i + 1);
  // Evaluar el array como JS (sin acceso a scope externo)
  return Function('"use strict"; return ' + arrText)();
}

function flattenAndroid(familias) {
  const products = [];
  for (const f of familias) {
    for (const v of f.variantes || []) {
      const almacenamiento = v.storage ? v.storage + ' GB' : null;
      const ram = v.ram ? v.ram + ' GB' : null;
      const nombre = f.nombre + (v.storage ? ` ${v.storage}GB` : '') + (v.ram ? `/${v.ram}GB RAM` : '');
      products.push({
        id: `android-${f.modeloBase}-${v.storage || 0}gb-${v.ram || 0}gb`,
        nombre,
        marca: f.marca,
        linkML: v.linkML || null,
        linkAmz: v.linkAmz || null,
        mlId: null,
        precioML: v.precio || null,
        precioAmz: v.precioAmz || null,
        activo: true,
        estadoML: 'sin_revisar',
        imagen: f.img || null,
        estrellas: v.estrellas || null,
        resenas: v.resenas || null,
        especs: {
          chip: f.chip || null,
          pantalla: f.pantalla ? f.pantalla + '"' : null,
          hz: f.hz ? f.hz + ' Hz' : null,
          bateria: f.bateriaMah ? f.bateriaMah + (f.bateriaMah < 10 ? 'k' : '') + ' mAh' : null,
          nfc: f.nfc === true ? 'Sí' : f.nfc === false ? 'No' : null,
          almacenamiento,
          ram,
          cam: f.camPrincipal ? f.camPrincipal + ' MP' : null,
        },
        _updatedAt: new Date().toISOString(),
      });
    }
  }
  return products;
}

function flattenIphone(familias) {
  const products = [];
  for (const f of familias) {
    for (const v of f.variantes || []) {
      const almacenamiento = v.almacenamientoGB ? v.almacenamientoGB + ' GB' : null;
      const nombre = f.nombre + (v.almacenamientoGB ? ` ${v.almacenamientoGB}GB` : '');
      products.push({
        id: v.id || `iphone-${f.modeloBase}-${v.almacenamientoGB || 0}gb`,
        nombre,
        marca: 'Apple',
        linkML: v.linkML || null,
        linkAmz: v.linkAmz || null,
        mlId: null,
        precioML: v.precioML || v.precio || null,
        precioAmz: v.precioAmz || null,
        activo: true,
        estadoML: 'sin_revisar',
        imagen: v.img || null,
        estrellas: v.estrellas || null,
        resenas: v.resenas || null,
        especs: {
          chip: f.chip || null,
          pantalla: f.pantalla ? f.pantalla + '"' : null,
          hz: f.hz ? f.hz + ' Hz' : null,
          usb: f.usb ? 'USB ' + f.usb : null,
          zoom: f.zoom ? f.zoom + 'x' : null,
          almacenamiento,
          serie: f.serie || null,
        },
        _updatedAt: new Date().toISOString(),
      });
    }
  }
  return products;
}

const androidHtml = readFileSync(resolve(ROOT, 'celulares/android/index.html'), 'utf8');
const iphoneHtml = readFileSync(resolve(ROOT, 'celulares/iphone/index.html'), 'utf8');

const androidFamilias = extractFamilias(androidHtml);
const iphoneFamilias = extractFamilias(iphoneHtml);

const androidProds = flattenAndroid(androidFamilias);
const iphoneProds = flattenIphone(iphoneFamilias);

const admin = JSON.parse(readFileSync(ADMIN_PATH, 'utf8'));
admin.celulares_android = androidProds;
admin.celulares_iphone = iphoneProds;

writeFileSync(ADMIN_PATH, JSON.stringify(admin, null, 2), 'utf8');
console.log(`✓ Android: ${androidProds.length} variantes de ${androidFamilias.length} familias`);
console.log(`✓ iPhone:  ${iphoneProds.length} variantes de ${iphoneFamilias.length} familias`);
console.log('✓ merged-admin.json actualizado');
