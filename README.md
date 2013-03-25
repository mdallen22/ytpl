YouTube List Embed
=====

	new YTPL(/* id */, /* options */);

### Easy As

	new YTPL('player', {list: 'SPOHbM4GGWADc5bZgvbivvttAuWGow6h05'});

## Options

Customize the player with the following options

- ####list (required)    
<p>For a YoutTube Playlist, set list = PlaylistID.</p>    
<p>For a custom list of videos, set list = array of query strings each with the following form ('video_id=W&author=X&title=Y&thumbnail=Z').</p>

- ####video_id (optional)    
<p>YouTube video ID. Playlist will begin with this video. If left blank, playlist will begin on first video.</p>

- ####autoplay (optional)    
<p>If true videos will play as soon as they are loaded. Defaults to false.</p>

- ####shuffle (optional)    
<p>A number (should be a number from a shuffle event, but any 3 digit number will do) to shuffle the videos. If left blank the videos will not be shuffled.</p>

- ####playerw (optional)    
<p>Width of the YouTube player. Defaults to 640.</p>

- ####playerh (optional)    
<p>Height of the YouTube player. Defaults to 360.</p>

- ####playlistw (optional)    
<p>Width of the playlist. The playlist's height is always the same as the YouTube player's height. Defaults to 303.</p>

- ####ease (optional)    
<p>To hide the playlist until the user interacts with the YouTube player set easing = 2 element array.
The first element being on of the following strings 'linear', 'sin', 'bounce', or 'elastic'. 
The Second element being the run time of the animation in seconds.  
Defaults to false.</p>

## Events

	var ytpl = new YTPL('player', {list: 'SPOHbM4GGWADc5bZgvbivvttAuWGow6h05'});
	ytpl.add_listener(YTPL.PLAYLIST_READY, function(obj) {
		console.log('playlist ready');
	});

- ####YTPL.AUTOPLAY    
<p>Fired when autoplay is toggled. obj.autoplay will be true/false.</p>

- ####YTPL.SHUFFLE    
<p>Fired when shuffle is toggled. obj.shuffle will have the shuffle seed if shuffle is on, or will be undefined.</p>

- ####YTPL.PLAYLIST_READY    
<p>Fired when playlist is loaded.</p>

- ####YTPL.PLAYER_READY    
<p>Fired when player api is loaded.</p>

- ####YTPL.VIDEO_SELECTED    
<p>Fired when a video is selected in the playlist. obj has following properties: video_id, title, author, thumbnail.</p>