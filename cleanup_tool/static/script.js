document.addEventListener('DOMContentLoaded', () => {
    let workouts = [];
    const workoutList = document.getElementById('workoutList');
    const searchBar = document.getElementById('searchBar');
    const materialFilter = document.getElementById('materialFilter');
    const sortOption = document.getElementById('sortOption');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const apiKeyInput = document.getElementById('apiKey');

    // Load API Key from local storage
    if (localStorage.getItem('youtube_api_key')) {
        apiKeyInput.value = localStorage.getItem('youtube_api_key');
    }

    // Save API Key on change
    apiKeyInput.addEventListener('input', () => {
        localStorage.setItem('youtube_api_key', apiKeyInput.value);
    });

    let analysisData = {}; // Store analysis results

    // Fetch Workouts
    fetch('/api/workouts')
        .then(res => res.json())
        .then(data => {
            workouts = data;
            populateFilterOptions();
            renderWorkouts();
        })
        .catch(err => console.error(err));

    analyzeBtn.addEventListener('click', () => {
        analyzeBtn.textContent = 'Analyseren...';
        analyzeBtn.disabled = true;

        const headers = { 'Content-Type': 'application/json' };
        if (apiKeyInput.value) {
            headers['X-Youtube-Api-Key'] = apiKeyInput.value;
        }

        fetch('/api/analyze', { headers })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                analysisData = data;
                analyzeBtn.textContent = 'Gereed';
                analyzeBtn.disabled = false;

                // Switch sort to match_asc to show worst matches first
                sortOption.value = 'match_asc';
                renderWorkouts();
            })
            .catch(err => {
                console.error(err);
                analyzeBtn.textContent = 'Fout';
                analyzeBtn.style.background = 'var(--danger)';

                // Show error in a more visible way if possible, or just alert
                const errDiv = document.createElement('div');
                errDiv.className = 'error-banner';
                errDiv.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:red; color:white; padding:15px; border-radius:8px; z-index:1000; box-shadow:0 4px 6px rgba(0,0,0,0.2);';
                errDiv.textContent = 'Fout bij analyseren: ' + err.message;
                document.body.appendChild(errDiv);
                setTimeout(() => errDiv.remove(), 5000);

                analyzeBtn.disabled = false;
            });
    });

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
        const currentSort = sortOption.value;

        let filtered = workouts.filter(w => {
            const matchesSearch = w.exercise_name.toLowerCase().includes(searchTerm);
            const matchesMaterial = selectedMaterial === 'all' || w.material_name === selectedMaterial;
            return matchesSearch && matchesMaterial;
        });

        // Sorting
        filtered.sort((a, b) => {
            if (currentSort === 'name') {
                return a.exercise_name.localeCompare(b.exercise_name);
            } else if (currentSort === 'match_asc' || currentSort === 'match_desc') {
                const scoreA = analysisData[a.id]?.match_score ?? 100; // Default to 100 if no data (assume good)
                const scoreB = analysisData[b.id]?.match_score ?? 100;
                return currentSort === 'match_asc' ? scoreA - scoreB : scoreB - scoreA;
            }
            return 0;
        });

        filtered.forEach(workout => {
            const item = createWorkoutItem(workout);
            workoutList.appendChild(item);
        });
    }

    function createWorkoutItem(workout) {
        const ad = analysisData[workout.id];
        const matchScore = ad ? ad.match_score : null;
        let scoreColor = 'var(--text-secondary)';
        if (matchScore !== null) {
            if (matchScore < 40) scoreColor = 'var(--danger)';
            else if (matchScore < 80) scoreColor = 'orange';
            else scoreColor = 'var(--success)';
        }

        // Dark gray placeholder SVG
        const fallbackImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='68' viewBox='0 0 120 68'%3E%3Crect width='120' height='68' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' fill='%23aaa'%3EGeen Video%3C/text%3E%3C/svg%3E";

        const div = document.createElement('div');
        div.className = 'workout-item expanded'; // Default to expanded
        div.innerHTML = `
            <div class="workout-header" onclick="toggleDetails(this, '${workout.id}', '${workout.exercise_name.replace(/'/g, "\\'")}')">
                <img src="${workout.thumbnail || fallbackImage}" class="current-thumb" onerror="this.onerror=null; this.src='${fallbackImage}'">
                <div class="workout-info">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <h3>${workout.exercise_name} 
                            ${matchScore !== null ? `<span style="font-size:0.8em; color:${scoreColor}">(${matchScore}% Match)</span>` : ''}
                        </h3>
                        <button class="icon-btn" onclick="event.stopPropagation(); copyToClipboard('${workout.material_name} ${workout.exercise_name.replace(/'/g, "\\'")}', this)" title="Kopieer: ${workout.material_name} ${workout.exercise_name}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
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
                <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                    <div style="flex: 1;">
                         <h4>Instructies</h4>
                         <p>${workout.instructions}</p>
                    </div>
                    <div style="flex: 1;">
                         <h4>Huidige Video Info</h4>
                         ${ad ? `<p><strong>Titel:</strong> ${ad.video_title}</p><p><strong>Beschrijving:</strong> <span style="font-size:0.9em; opacity:0.8;">${ad.video_description.substring(0, 150)}...</span></p>` : '<p>Klik op "Analyzeren" om info te laden.</p>'}
                         <p><strong>Link:</strong> <a href="${workout.video_search_url}" target="_blank">Open op YouTube</a></p>
                    </div>
                </div>
                
                <div style="margin-top:20px; border-top:1px solid #444; padding-top:15px;">
                     <h4>Gebruik Custom Video URL</h4>
                     <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input type="text" id="customUrl-${workout.id}" placeholder="Plak YouTube URL (bijv. shorts)" style="flex:1;">
                        <button onclick="checkCustomUrl('${workout.id}')" class="primary-btn" style="background:var(--accent);">Check</button>
                     </div>
                     <div id="customPreview-${workout.id}"></div>
                </div>
                
                <h4 style="margin-top:20px;">Of Zoek Alternatieven</h4>
                <button onclick="searchAlternatives('${workout.exercise_name.replace(/'/g, "\\'")}', '${workout.id}')" class="primary-btn">Zoek Alternatieven (Shorts)</button>
                <div id="results-${workout.id}" class="search-results"></div>
            </div>
        `;
        return div;
    }

    // Event Listeners for Filters
    searchBar.addEventListener('input', renderWorkouts);
    materialFilter.addEventListener('change', renderWorkouts);
    sortOption.addEventListener('change', renderWorkouts);

    window.toggleDetails = (header, id, name) => {
        const item = header.parentElement;
        item.classList.toggle('expanded');
    };

    window.searchAlternatives = (query, id) => {
        const resultsContainer = document.getElementById(`results-${id}`);
        resultsContainer.innerHTML = '<p>Zoeken...</p>';

        const workout = workouts.find(w => w.id === id);
        // User requested: Material then Exercise Name
        const fullQuery = `${workout.material_name} ${query}`;

        const headers = { 'Content-Type': 'application/json' };
        if (apiKeyInput.value) {
            headers['X-Youtube-Api-Key'] = apiKeyInput.value;
        }

        fetch('/api/search_videos', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                query: fullQuery,
                exercise_name: workout.exercise_name
            })
        })
            .then(res => res.json())
            .then(results => {
                resultsContainer.innerHTML = '';
                if (results.error) {
                    resultsContainer.innerHTML = `<p class="error">${results.error}</p>`;
                    return;
                }
                results.forEach(video => {
                    let matchBadge = '';
                    if (video.match_score !== undefined) {
                        let color = 'var(--text-secondary)';
                        if (video.match_score < 40) color = 'var(--danger)';
                        else if (video.match_score < 80) color = 'orange';
                        else color = 'var(--success)';
                        matchBadge = `<span style="font-size:0.8em; color:${color}; font-weight:bold; margin-left: 10px;">(${video.match_score}% Match)</span>`;
                    }

                    const card = document.createElement('div');
                    card.className = 'video-card';
                    card.innerHTML = `
                    <div style="position:relative;">
                        <img src="${video.thumbnail}">
                        <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); padding:2px 5px; border-radius:4px; font-size:0.8em;">Video</div>
                    </div>
                    <div style="padding: 10px;">
                        <h4>${video.title} ${matchBadge}</h4>
                        <p style="font-size:0.8em; color:#aaa; margin-top:5px;">${video.description.substring(0, 100)}...</p>
                        <button class="select-btn" onclick="selectVideo('${id}', '${video.embedUrl}', '${video.thumbnail}', this)" style="margin-top:10px;">Kies deze video</button>
                        <button class="preview-btn" onclick="previewVideo('${video.embedUrl}')" style="width:100%; margin-top:5px; background:#444; border:none; color:white; padding:5px; cursor:pointer;">Preview</button>
                    </div>
                `;
                    resultsContainer.appendChild(card);
                });
            })
            .catch(err => {
                resultsContainer.innerHTML = `<p>Error searching.</p>`;
                console.error(err);
            });
    };

    window.checkCustomUrl = (id) => {
        const input = document.getElementById(`customUrl-${id}`);
        const previewContainer = document.getElementById(`customPreview-${id}`);
        const url = input.value;

        if (!url) return;

        previewContainer.innerHTML = '<p>Controleren...</p>';

        const headers = { 'Content-Type': 'application/json' };
        if (apiKeyInput.value) {
            headers['X-Youtube-Api-Key'] = apiKeyInput.value;
        }

        fetch('/api/resolve_video', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ url: url })
        })
            .then(res => res.json())
            .then(video => {
                if (video.error) {
                    previewContainer.innerHTML = `<p class="error">${video.error}</p>`;
                    return;
                }

                // Reuse the card style
                const card = document.createElement('div');
                card.className = 'video-card';
                card.style.maxWidth = '400px';
                card.innerHTML = `
                <div style="position:relative;">
                    <img src="${video.thumbnail}">
                </div>
                <div style="padding: 10px;">
                    <h4>${video.title}</h4>
                    <button class="select-btn" onclick="selectVideo('${id}', '${video.embedUrl}', '${video.thumbnail}', this)" style="margin-top:10px; width:100%; background:var(--success);">Kies deze video</button>
                </div>
            `;
                previewContainer.innerHTML = '';
                previewContainer.appendChild(card);
            })
            .catch(err => {
                previewContainer.innerHTML = `<p class="error">Error: ${err.message}</p>`;
            });
    };

    window.selectVideo = (workoutId, videoUrl, thumbUrl, btnElement) => {
        // Remove confirm dialog to avoid blocking issues
        // if (!confirm("Database bijwerken met deze video?")) return;

        // Visual feedback
        const originalText = btnElement.textContent;
        btnElement.textContent = 'Updating...';
        btnElement.disabled = true;

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
                // Replace alert with visual feedback
                // alert(data.message);
                btnElement.textContent = 'Updated!';
                btnElement.style.background = 'var(--success)';

                // Update local state
                const w = workouts.find(x => x.id === workoutId);
                w.video_search_url = videoUrl;
                w.thumbnail = thumbUrl;

                // Update the UI after a short delay
                setTimeout(() => {
                    renderWorkouts(); // Re-render to show update
                }, 1000);
            })
            .catch(err => {
                console.error(err);
                btnElement.textContent = 'Error';
                btnElement.style.background = 'var(--danger)';
                btnElement.disabled = false;
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

    window.copyToClipboard = (text, btn) => {
        navigator.clipboard.writeText(text).then(() => {
            const icon = btn.querySelector('i');
            icon.className = 'fas fa-check';
            btn.style.color = 'var(--success)';
            setTimeout(() => {
                icon.className = 'fas fa-copy';
                btn.style.color = '';
            }, 2000);
        });
    };

    window.onclick = (e) => {
        if (e.target == modal) {
            modal.classList.add('hidden');
            document.getElementById('videoPlayerContainer').innerHTML = '';
        }
    };
});
