from flask import Flask, render_template, jsonify, request
import json
import os
import logging
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

API_KEY = os.getenv('YOUTUBE_API_KEY')
youtube = build('youtube', 'v3', developerKey=API_KEY) if API_KEY else None

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'workoutdatabase.json')

def load_db():
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        app.logger.error(f"Error loading database: {e}")
        return []

def save_db(data):
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/workouts', methods=['GET'])
def get_workouts():
    workouts = load_db()
    return jsonify(workouts)

import re
from difflib import SequenceMatcher

def extract_video_id(url):
    # Supports:
    # https://www.youtube.com/watch?v=ID
    # https://www.youtube.com/embed/ID
    # https://youtu.be/ID
    if not url: return None
    import re
    # Match 11 char id
    match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11}).*', url)
    return match.group(1) if match else None

def similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def get_youtube_client():
    # Priority: Header > Env Var
    api_key_header = request.headers.get('X-Youtube-Api-Key')
    if api_key_header:
        return build('youtube', 'v3', developerKey=api_key_header)
    
    # Fallback to env var if initialized
    if youtube: 
        return youtube
    return None

@app.route('/api/analyze', methods=['GET'])
def analyze_database():
    yt_client = get_youtube_client()
    if not yt_client:
        return jsonify({'error': 'No API Key provided. Please enter it above or configure .env'}), 500
    
    workouts = load_db()
    
    # Collect IDs to fetch
    # Map video_id -> list of workout_indices (one video might be used multiple times)
    vid_map = {}
    for idx, w in enumerate(workouts):
        vid = extract_video_id(w.get('video_search_url'))
        if vid:
            if vid not in vid_map: vid_map[vid] = []
            vid_map[vid].append(idx)
    
    all_vids = list(vid_map.keys())
    
    # Batch request (max 50)
    video_details = {}
    
    # Chunking
    for i in range(0, len(all_vids), 50):
        batch = all_vids[i:i+50]
        try:
            resp = yt_client.videos().list(
                part="snippet",
                id=','.join(batch)
            ).execute()
            
            for item in resp.get('items', []):
                video_details[item['id']] = {
                    'title': item['snippet']['title'],
                    'description': item['snippet']['description']
                }
        except Exception as e:
            app.logger.error(f"Batch fetch failed: {e}")
            return jsonify({'error': f"Batch fetch failed: {str(e)}"}), 500
            
    # Calculate scores
    results = {}
    for vid, details in video_details.items():
        # For each workout using this video
        for w_idx in vid_map.get(vid, []):
            w = workouts[w_idx]
            w_id = w['id']
            
            # Score: Text match of Name vs Title
            title_score = similarity(w['exercise_name'], details['title'])
            
            results[w_id] = {
                'video_title': details['title'],
                'video_description': details['description'],
                'match_score': round(title_score * 100)
            }
            
    return jsonify(results)

@app.route('/api/search_videos', methods=['POST'])
def search_videos():
    yt_client = get_youtube_client()
    if not yt_client:
        return jsonify({'error': 'No API Key provided. Please enter it above.'}), 500

    data = request.json
    query = data.get('query')
    exercise_name = data.get('exercise_name') # For scoring
    
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    search_query = f"{query} shorts"
    
    try:
        request_search = yt_client.search().list(
            part="snippet",
            maxResults=5,
            q=search_query,
            type="video"
        )
        response = request_search.execute()
        
        results = []
        for item in response['items']:
            video_id = item['id']['videoId']
            title = item['snippet']['title']
            desc = item['snippet']['description']
            thumbnails = item['snippet']['thumbnails']
            thumb_url = thumbnails.get('high', thumbnails.get('medium', thumbnails.get('default')))['url']
            
            match_score = 0
            if exercise_name:
                match_score = round(similarity(exercise_name, title) * 100)

            results.append({
                'videoId': video_id,
                'title': title,
                'description': desc,
                'thumbnail': thumb_url,
                'url': f"https://www.youtube.com/watch?v={video_id}",
                'embedUrl': f"https://www.youtube.com/embed/{video_id}",
                'match_score': match_score
            })
        return jsonify(results)
    except Exception as e:
        app.logger.error(f"Search failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/update_workout', methods=['POST'])
def update_workout():
    data = request.json
    workout_id = data.get('workout_id')
    new_video_url = data.get('video_url')
    new_thumbnail = data.get('thumbnail_url')
    # Optional: check_number to identify? ID should be unique.
    
    if not workout_id:
        return jsonify({'error': 'Missing workout_id'}), 400

    db_data = load_db()
    updated = False
    for workout in db_data:
        if workout.get('id') == workout_id:
            if new_video_url:
                workout['video_search_url'] = new_video_url
            if new_thumbnail:
                workout['thumbnail'] = new_thumbnail
            updated = True
            break
    
    if updated:
        save_db(db_data)
        return jsonify({'message': 'Requirement updated successfully'})
    else:
        return jsonify({'error': 'Workout not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5050)
