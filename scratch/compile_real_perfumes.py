import os
import urllib.request
import re
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# Define paths
WORKSPACE_DIR = r"c:\Users\HP\Downloads\UI"
DATA_FILE = os.path.join(WORKSPACE_DIR, "data", "fragrances.json")
OUTPUT_IMAGE_DIR = os.path.join(WORKSPACE_DIR, "assets", "images", "real")

# Ensure output directory exists
os.makedirs(OUTPUT_IMAGE_DIR, exist_ok=True)

# Headers for request (Fragrantica requires a browser User-Agent to avoid 403 Forbidden)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Referer': 'https://www.fragrantica.com/'
}

def download_image(perfume_id, url):
    dest_path = os.path.join(OUTPUT_IMAGE_DIR, f"{perfume_id}.avif")
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as response:
            with open(dest_path, 'wb') as f:
                f.write(response.read())
        # Validate that the file is successfully downloaded and is not empty
        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
            return f"assets/images/real/{perfume_id}.avif"
    except Exception as e:
        print(f"Failed download for ID {perfume_id} from {url}: {e}", file=sys.stderr)
    return None

def process_perfume(perfume):
    raw_url = perfume.get('rawImageUrl')
    if raw_url:
        # Extract the image ID from the old URL (e.g. o.8021.jpg -> 8021)
        match = re.search(r'o\.(\d+)\.(jpg|png|jpeg)', raw_url)
        if match:
            num = match.group(1)
            # Construct the new Fragrantica AVIF URL
            new_url = f"https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.{num}.2x.avif"
            print(f"Downloading [{perfume['id']}] {perfume['brand']} {perfume['name']} from new Fragrantica CDN: {new_url}...")
            
            local_path = download_image(perfume['id'], new_url)
            if local_path:
                perfume['image'] = local_path
                print(f"-> Successfully downloaded [{perfume['id']}] to {local_path}")
                return perfume
                
    # Fallback to family default image if download fails or rawImageUrl is missing
    family_default = f"assets/images/{perfume['scentFamily'].lower()}.png"
    perfume['image'] = family_default
    print(f"-> Using fallback default for [{perfume['id']}]: {family_default}")
    return perfume

def main():
    if not os.path.exists(DATA_FILE):
        print(f"Error: {DATA_FILE} not found. Run parse_csv_database.js first.", file=sys.stderr)
        sys.exit(1)
        
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        perfumes = json.load(f)
        
    print(f"Loaded {len(perfumes)} perfumes. Starting direct AVIF image compiler...")
    
    updated_perfumes = []
    
    # Run in parallel using a ThreadPoolExecutor (15 concurrent threads)
    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(process_perfume, p): p for p in perfumes}
        for future in as_completed(futures):
            try:
                res = future.result()
                updated_perfumes.append(res)
            except Exception as exc:
                print(f"Generated an exception: {exc}", file=sys.stderr)
                
    # Sort updated perfumes by ID
    updated_perfumes.sort(key=lambda x: x['id'])
    
    # Save back to fragrances.json
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(updated_perfumes, f, indent=2)
        
    print("\nCompilation complete! fragrances.json database updated with new AVIF image paths.")

if __name__ == "__main__":
    main()
