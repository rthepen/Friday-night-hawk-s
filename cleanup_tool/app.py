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

@app.route('/api/search_videos', methods=['POST'])
def search_videos():
    if not youtube:
        return jsonify({'error': 'YouTube API Key not configured. Please add YOUTUBE_API_KEY to .env'}), 500

    query = request.json.get('query')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    # User specifically asked for shorts: "het liefste youtube shorts"
    # We can add 'shorts' to the query, or use videoDuration='short' (less than 4 mins, but technically shorts are <1 min)
    # Let's try adding "shorts" string first as it might be more effective for finding actual Shorts format.
    search_query = f"{query} shorts"
    
    try:
        request_search = youtube.search().list(
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
            thumbnails = item['snippet']['thumbnails']
            # Get highest resolution available
            thumb_url = thumbnails.get('high', thumbnails.get('medium', thumbnails.get('default')))['url']
            
            results.append({
                'videoId': video_id,
                'title': title,
                'thumbnail': thumb_url,
                'url': f"https://www.youtube.com/watch?v={video_id}",
                'embedUrl': f"https://www.youtube.com/embed/{video_id}"
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
    app.run(debug=True, port=5000)
