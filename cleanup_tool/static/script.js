document.addEventListener('DOMContentLoaded', () => {
    let workouts = [];
    const workoutList = document.getElementById('workoutList');
    const searchBar = document.getElementById('searchBar');
    const materialFilter = document.getElementById('materialFilter');
    const matchSort = document.getElementById('matchSort');

    // Fetch Workouts
    fetch('/api/workouts')
        .then(res => res.json())
        .then(data => {
            workouts = data;
            populateFilterOptions();
            renderWorkouts();
        })
        .catch(err => console.error(err));

    function populateFilterOptions() {
        const materials = new Set(workouts.map(w => w.material_name));
        materials.forEach(mat => {
            const option = document.createElement('option');
            option.value = mat;
            option.textContent = mat;
            materialFilter.appendChild(option);
        });
    }

    function renderWorkouts() {
        workoutList.innerHTML = '';
        const searchTerm = searchBar.value.toLowerCase();
        const selectedMaterial = materialFilter.value;
        const showMissingOnly = matchSort.checked;

        const filtered = workouts.filter(w => {
            const matchesSearch = w.exercise_name.toLowerCase().includes(searchTerm);
            const matchesMaterial = selectedMaterial === 'all' || w.material_name === selectedMaterial;
            // Assuming "missing" means no video URL or a placeholder one? Or just based on user preference?
            // User said: "sorteren op match" and "zet alle workouts onder elkaar".
            // Let's interpret "missing only" as empty video_search_url? 
            // Or maybe the user wants to see everything but sort those with issues first.
            // For now, simple filter.
            return matchesSearch && matchesMaterial;
        });

        if (showMissingOnly) {
            // Maybe sort by "has thumbnail/video"
            filtered.sort((a, b) => (a.video_search_url ? 1 : -1));
        }

        filtered.forEach(workout => {
            const item = createWorkoutItem(workout);
            workoutList.appendChild(item);
        });
    }

    function createWorkoutItem(workout) {
        const div = document.createElement('div');
        div.className = 'workout-item';
        div.innerHTML = `
            <div class="workout-header" onclick="toggleDetails(this, '${workout.id}', '${workout.exercise_name.replace(/'/g, "\\'")}')">
                <img src="${workout.thumbnail || ''}" class="current-thumb" onerror="this.src='https://via.placeholder.com/120x68?text=No+Thumb'">
                <div class="workout-info">
                    <h3>${workout.exercise_name}</h3>
                    <div class="workout-meta">
                        <span>${workout.category}</span>
                        <span>|</span>
                        <span>${workout.material_name}</span>
                    </div>
                </div>
                <div class="status-indicator ${workout.video_search_url ? 'done' : ''}">
                    <i class="fas fa-check-circle"></i>
                </div>
            </div>
            <div class="workout-details" id="details-${workout.id}">
                <p><strong>Instructions:</strong> ${workout.instructions}</p>
                <p><strong>Current Video:</strong> <a href="${workout.video_search_url}" target="_blank">${workout.video_search_url}</a></p>
                <button onclick="searchAlternatives('${workout.exercise_name}', '${workout.id}')" class="primary-btn">Find Alternatives (Shorts)</button>
                <div id="results-${workout.id}" class="search-results"></div>
            </div>
        `;
        return div;
    }

    // Event Listeners for Filters
    searchBar.addEventListener('input', renderWorkouts);
    materialFilter.addEventListener('change', renderWorkouts);
    matchSort.addEventListener('change', renderWorkouts);

    window.toggleDetails = (header, id, name) => {
        const item = header.parentElement;
        item.classList.toggle('expanded');
    };

    window.searchAlternatives = (query, id) => {
        const resultsContainer = document.getElementById(`results-${id}`);
        resultsContainer.innerHTML = '<p>Searching...</p>';

        // Include material in search for better results
        // We find the workout object to get the material
        const workout = workouts.find(w => w.id === id);
        const fullQuery = `${query} ${workout.material_name}`;

        fetch('/api/search_videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: fullQuery })
        })
            .then(res => res.json())
            .then(results => {
                resultsContainer.innerHTML = '';
                if (results.error) {
                    resultsContainer.innerHTML = `<p class="error">${results.error}</p>`;
                    return;
                }
                results.forEach(video => {
                    const card = document.createElement('div');
                    card.className = 'video-card';
                    card.innerHTML = `
                    <img src="${video.thumbnail}">
                    <h4>${video.title}</h4>
                    <button class="select-btn" onclick="selectVideo('${id}', '${video.embedUrl}', '${video.thumbnail}')">Select This Video</button>
                    <button class="preview-btn" onclick="previewVideo('${video.embedUrl}')" style="width:100%; margin-top:5px;">Preview</button>
                `;
                    resultsContainer.appendChild(card);
                });
            })
            .catch(err => {
                resultsContainer.innerHTML = `<p>Error searching.</p>`;
                console.error(err);
            });
    };

    window.selectVideo = (workoutId, videoUrl, thumbUrl) => {
        if (!confirm("Update database with this video?")) return;

        fetch('/api/update_workout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workout_id: workoutId,
                video_url: videoUrl,
                thumbnail_url: thumbUrl
            })
        })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                // Update local state
                const w = workouts.find(x => x.id === workoutId);
                w.video_search_url = videoUrl;
                w.thumbnail = thumbUrl;
                renderWorkouts(); // Re-render to show update
            });
    };

    // Modal logic
    const modal = document.getElementById('videoModal');
    const closeBtn = document.querySelector('.close-modal');

    window.previewVideo = (url) => {
        const container = document.getElementById('videoPlayerContainer');
        container.innerHTML = `<iframe src="${url}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        modal.classList.remove('hidden');
    };

    closeBtn.onclick = () => {
        modal.classList.add('hidden');
        document.getElementById('videoPlayerContainer').innerHTML = '';
    };

    window.onclick = (e) => {
        if (e.target == modal) {
            modal.classList.add('hidden');
            document.getElementById('videoPlayerContainer').innerHTML = '';
        }
    };
});
