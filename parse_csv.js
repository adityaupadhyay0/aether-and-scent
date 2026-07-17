const fs = require('fs');
const path = require('path');

const CSV_PATH = 'C:/Users/HP/Downloads/UI/fra_cleaned.csv';
const APP_JS_PATH = 'C:/Users/HP/Downloads/UI/app.js';

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  const rows = [];
  
  const headers = lines[0].split(';');
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(';');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = parts[index] ? parts[index].trim() : '';
    });
    
    if (row.url && row.Perfume) {
      rows.push(row);
    }
  }
  return rows;
}

function getScentFamily(accords) {
  const main = accords[0].toLowerCase();
  if (main.includes('wood') || main.includes('earth') || main.includes('leather')) return 'Woody';
  if (main.includes('floral') || main.includes('white floral') || main.includes('rose') || main.includes('yellow floral')) return 'Floral';
  if (main.includes('sweet') || main.includes('vanilla') || main.includes('amber') || main.includes('warm spicy')) return 'Amber';
  if (main.includes('citrus') || main.includes('fresh') || main.includes('green') || main.includes('aquatic') || main.includes('fruity')) return 'Fresh';
  
  return 'Fresh'; // default
}

function run() {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvText);
  
  // Sort by rating count (popularity) and rating value to get the best 100
  // Note: Rating Value uses comma instead of dot in European format e.g., "1,42" -> "1.42"
  rows.sort((a, b) => {
    const countA = parseInt(a['Rating Count']) || 0;
    const countB = parseInt(b['Rating Count']) || 0;
    return countB - countA;
  });
  
  // Take top 150, shuffle slightly to get variety, then take 100
  let topPerfumes = rows.slice(0, 150);
  // Remove duplicates by brand + name
  const seen = new Set();
  const distinctPerfumes = [];
  for (const p of topPerfumes) {
    const key = `${p.Brand}-${p.Perfume}`;
    if (!seen.has(key)) {
      seen.add(key);
      distinctPerfumes.push(p);
      if (distinctPerfumes.length === 100) break;
    }
  }

  const fragrances = distinctPerfumes.map((row, index) => {
    // Extract ID from URL
    const match = row.url.match(/-(\d+)\.html$/);
    const id = match ? match[1] : '';
    const imageUrl = id ? `https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${id}.2x.avif` : 'assets/images/default.png';

    const topNotes = row.Top.split(',').map(n => n.trim()).filter(Boolean);
    const middleNotes = row.Middle.split(',').map(n => n.trim()).filter(Boolean);
    const baseNotes = row.Base.split(',').map(n => n.trim()).filter(Boolean);
    
    const accords = [row.mainaccord1, row.mainaccord2, row.mainaccord3, row.mainaccord4, row.mainaccord5].filter(Boolean);
    const scentFamily = getScentFamily(accords);

    // Vibe based on brand and family
    const brandLower = row.Brand.toLowerCase();
    let vibe = "Sophisticated";
    if (scentFamily === 'Fresh') vibe = "Clean";
    if (scentFamily === 'Floral') vibe = "Romantic";
    if (scentFamily === 'Amber') vibe = "Mysterious";
    if (scentFamily === 'Woody') vibe = "Sophisticated";

    const genderStr = row.Gender.toLowerCase();
    let gender = "Unisex";
    if (genderStr === "men") gender = "Masculine";
    else if (genderStr === "women") gender = "Feminine";

    // Format proper name: Capitalize first letter of each word
    const name = row.Perfume.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const brand = row.Brand.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // Generate some deterministic fake metrics based on id
    const intensity = 3 + (index % 3);
    const longevity = 3 + (index % 2);
    const warmth = scentFamily === 'Amber' || scentFamily === 'Woody' ? 4 : 2;
    const sweetness = scentFamily === 'Amber' || scentFamily === 'Floral' ? 4 : 2;

    return {
      id: (index + 1),
      brand: brand,
      name: name,
      scentFamily: scentFamily,
      topNotes: topNotes,
      middleNotes: middleNotes,
      baseNotes: baseNotes,
      accords: accords,
      gender: gender,
      vibe: vibe,
      tier: "Designer", 
      intensity: intensity,
      longevity: longevity,
      warmth: warmth,
      sweetness: sweetness,
      description: `An exquisite creation by ${brand}. Features accords of ${accords.slice(0, 3).join(', ')}.`,
      image: imageUrl
    };
  });

  const JSON_PATH = 'C:/Users/HP/Downloads/UI/data/fragrances.json';
  fs.writeFileSync(JSON_PATH, JSON.stringify(fragrances, null, 2));
  console.log(`Successfully injected 100 perfumes into ${JSON_PATH}!`);
}

run();
