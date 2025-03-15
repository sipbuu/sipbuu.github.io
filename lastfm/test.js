const SPOTIFY_API_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const RECENTLY_PLAYED_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=1';
const CLIENT_ID = 'e0b6c49d7f49401593932b51dc4cbe6b'; 
const REDIRECT_URI = 'https://sipbuu.club/lastfm'; 

let accessToken = getStoredAccessToken();
let intervalId;
let progressIntervalId;
let currentProgress = 0;
let durationMs = 0; 
let currentTrack = {}; 
let status;
let curtrack;
let currentARTIST;
let currentSONG;

function getAccessToken() {
    console.log('getting token.')
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('access_token');

    if (token) {
        localStorage.setItem('spotifyToken', token);
    }

    return token;
}

function getStoredAccessToken() {
    const token = localStorage.getItem('spotifyToken');
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    const urltoken = params.get('access_token');
    if (urltoken == token) {
        console.log(token)
        return token;
    } else {
        return getAccessToken();
    }
}

async function fetchCurrentTrack() {
    try {
        if (!accessToken) { console.log("no access token"); accessToken = getStoredAccessToken()}
        const response = await fetch(SPOTIFY_API_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(response)
        if (response.status === 204) {
            const recentResponse = await fetch(RECENTLY_PLAYED_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!recentResponse.ok && !response.status === 502 && !response.status == 500) {
                const errorText = await recentResponse.text();
                throw new Error(`Error fetching recently played track: ${recentResponse.status} ${errorText}`);
            } else if (response.status === 502 || response.status == 500) {
                displayError("Spotify servers are likely down or still recovering from an outage, try and come back once it's stable.");
                clearIntervals()
            }

            const recentData = await recentResponse.json();
            if (recentData.items && recentData.items.length > 0) {
                const recentTrack = recentData.items[0].track;
                const playedAt = new Date(recentData.items[0].played_at);
                displayTrack(recentTrack, "most recent song", playedAt);
                onupdate(recentTrack)
                previewurl = recentTrack.preview_url
                curtrack = recentTrack
            } else {
                if (recentData.status == 500) {
                    displayError("spotify servers are likely down or still recovering from an outage, try and come back once it's stable.");
                    clearIntervals()
                } else if (!recentData.status == 502){
                    displayNoTrack();
                    clearIntervals()
                }
            }
        } else if (response.status === 401) {
            window.location.href = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=user-read-playback-state user-read-currently-playing user-read-recently-played`;
        } else if (response.status === 502 || response.status == 500) {
            displayError("Spotify servers are likely down or still recovering from an outage, try and come back once it's stable.");
            clearIntervals()
        } else if (!response.ok && response.status != 502 && response.status != 500) {
            const errorText = await response.text();
            throw new Error(`Error fetching the current track: ${response.status} ${errorText}`);
        } else {
            const data = await response.json();
            if (data && data.is_playing) {
                currentProgress = data.progress_ms; 
                durationMs = data.item.duration_ms; 
                currentTrack = data.item;
                displayTrack(currentTrack, "currently playing", null, durationMs);
                status = true;
                onupdate()
            } else {
                status = false;
                const recentResponse = await fetch(RECENTLY_PLAYED_URL, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!recentResponse.ok) {
                    const errorText = await recentResponse.text();
                    throw new Error(`Error fetching recently played track: ${recentResponse.status} ${errorText}`);
                } else if (recentResponse.status == 502) {
                    displayError("Spotify servers are likely down, check their website status. Come back when it's not down.");
                    clearIntervals()
                }

                const recentData = await recentResponse.json();
                console.log(recentData)
                if (recentData.items && recentData.items.length > 0) {
                    const recentTrack = recentData.items[0].track;
                    console.log(recentTrack)
                    const playedAt = new Date(recentData.items[0].played_at);
                    displayTrack(recentTrack, "recent song", playedAt);
                    onupdate(recentData)
                    previewurl = recentTrack.preview_url
                    curtrack = recentTrack
                } else if (recentData.status == 502) {
                    displayError("Spotify servers are likely down or still recovering from an outage, try and come back once it's stable.");
                    clearIntervals()
                } else if (!recentData.status == 502) {
                    displayNoTrack(); 
                    clearIntervals()
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
        displayError(error);
        clearIntervals()
        alert("ERROR")
    }
}
function displayTrack(track, status, playedAt = null, durationMs = 0) {
    const trackContainer = document.getElementById('track-container'); 

    let trackInfoHtml;
    if (status == "currently playing") {
        trackInfoHtml = `
        <h2>${status}</h2>
        <p><strong id="track-title">title:</strong> ${track.name}</p>
        <p><strong id="track-artist">artist:</strong> ${track.artists.map(artist => artist.name).join(', ')}</p>
        <p><strong id="album-name">album:</strong> ${track.album.name}</p>
        <img src="${track.album.images[0].url}" alt="${track.name}">
        <div class="progress-bar">
            <div class="progress" style="width: ${(currentProgress / durationMs) * 100}%"></div>
        </div>
        <p>${formatTime(currentProgress)} / ${formatTime(durationMs)}</p>
    `;
    } else {
        trackInfoHtml = `
        <h2>${status}</h2>
        <p><strong id="track-title">title:</strong> ${track.name}</p>
        <p><strong id="track-artist">artist:</strong> ${track.artists.map(artist => artist.name).join(', ')}</p>
        <p><strong>album:</strong> ${track.album.name}</p>
        <img src="${track.album.images[0].url}" alt="${track.name}">
        <p><strong>last played:</strong> ${playedAt.toLocaleString()}</p>
    `;
    }

    currentARTIST = track.artists[0].name
    currentSONG = track.name

    trackContainer.querySelector('.track-info').innerHTML = trackInfoHtml;

    let lyricsElement = document.getElementById('lyrics');
    if (!lyricsElement) {
        lyricsElement = document.createElement('div');
        lyricsElement.className = 'lyrics';
        lyricsElement.id = 'lyrics';
        trackContainer.appendChild(lyricsElement);
    }
    function setBackgroundImage(url) {
        const background = document.getElementById('background');
        background.style.backgroundImage = `url(${url})`;
    }

    let releaseDate = track.release_date || 'Unknown Release Date';
    let genre = track.genre || 'Unknown Genre';

    setBackgroundImage(track.album.images[0].url);
    let curtrack;
    curtrack = track;
}



function displayNoTrack() {
    const trackContainer = document.getElementById('track-container');
    trackContainer.innerHTML = `<h2 class="no-track">No track is currently playing or found.</h2>`;
}

function displayError(error) {
    const trackContainer = document.getElementById('track-container');
    trackContainer.innerHTML = `<h2 class="no-track">Error</h2><p>${error.message}</p>`;
}

function formatTime(ms) {
    if (!ms) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function updateProgress() {
    if (durationMs > 0 && currentTrack && status) {
        currentProgress += 1000; 
        if (currentProgress > durationMs) {
            currentProgress = durationMs; 
        }
        displayTrack(currentTrack, "currently playing", null, durationMs);
        highlightLyrics(currentProgress);
    }
    
}

function clearIntervals() {
    clearInterval(intervalId);
    clearInterval(progressIntervalId); 
}

async function handleLogout() {
    localStorage.removeItem('spotifyToken');
    window.location.hash = ''; 
    document.getElementById('spotify-user').innerText = 'Logged out'; 
}

async function fetchSpotifyUser(accessToken) {
    const token = accessToken
    if (!token) {
      document.getElementById('spotify-user').innerText = 'Not logged in';
      return;
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();

        const displayName = userData.display_name && userData.display_name.trim() !== '' ? userData.display_name : userData.id;

        document.getElementById('spotify-user').innerText = displayName;
      } else {
        document.getElementById('spotify-user').innerText = 'Error fetching user';
      }
    } catch (error) {
      document.getElementById('spotify-user').innerText = 'Error fetching user';
      console.error(error);
    }
  }

async function initalizeSpotify() {
    if (!accessToken) {
        
        try {
            accessToken == getStoredAccessToken()
            console.log(accessToken)
        } catch(error) {
            console.log(error)
        }

        if (!accessToken) {
            console.log('no access token')
            window.location.href = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=user-read-playback-state user-read-currently-playing user-read-recently-played`
            document.getElementById('spotify-user').innerText = 'Not logged in';
            displayNoTrack()
        }
    } else {
        try {
            document.getElementById('logout-btn').addEventListener('click', handleLogout);
        } catch(err) {
            console.log(err)
        }
        console.log(accessToken)
        fetchSpotifyUser(accessToken)

        const newUrl = window.location.origin + window.location.pathname; 
        window.history.replaceState({}, document.title, newUrl); 
        intervalId = setInterval(fetchCurrentTrack, 15000); 
        progressIntervalId = setInterval(updateProgress, 1000); 
        onupdate()
        fetchCurrentTrack();
    }
}

initalizeSpotify()
