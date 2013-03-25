var YTPL = function(wrapper, opts) {
	this._id = +new Date();
	this._listeners = { };
	this._opts = YTPL.Util.extend(opts, {
		playerw: 640,
		playerh: 360,
		playlistw: 303
	});
	
	wrapper = (typeof wrapper == 'string') ? document.getElementById(wrapper) : wrapper;
	wrapper.innerHTML = YTPL.HTML.fill(YTPL.HTML.module, {id: this._id});
	
	this._selector = document.getElementById('ytpl-'+this._id);
	this._playlist_selector = document.getElementById('ytpl-'+this._id+'-pl');
	
	this._selector.style.height = this._opts.playerh+'px';
	this._selector.style.width = (this._opts.playerw+this._opts.playlistw)+'px';
	
	this._playlist_selector.style.height = (this._opts.playerh - 57) + 'px';
	
	if(this._opts.playlistw < 275) {
		YTPL.HTML.add_class(this._selector, 'sml');
	}
	
	YTPL.HTML.get_by_class('ytpl-col-right', this._selector).style.width = this._opts.playlistw+'px';
	
	if(this._opts.ease) {
		this._slider = new YTPL.Slider(YTPL.HTML.get_by_class('ytpl-pl-slider', this._selector));
		this._slider.turn_on((this._opts.ease.length == 2) ? (this._opts.ease[1] * 1000) : 1000, this._opts.ease[0]);
	}
	
	this._load_player_api();
	
	if(typeof this._opts.list == 'string') {
		var self = this;
		this.load_playlist(this._opts.list, function(xml) {
			self._on_playlist_load(self.from_xml(xml));
			self._notify(YTPL.PLAYLIST_READY);
		});
	} else {
		this._on_playlist_load(this._opts.list);
	}
	
	this._activate_nav();
};


YTPL.AUTOPLAY = 'autoplay';

YTPL.SHUFFLE = 'shuffle';

YTPL.PLAYLIST_READY = 'playlist_ready';

YTPL.PLAYER_READY= 'player_ready';

YTPL.VIDEO_SELECTED = 'video_selected';

YTPL.prototype = {
	
	add_listener: function(type, fn) {
		this._listeners[type] = this._listeners[type] || [ ];
		this._listeners[type].push(fn);
	},
	
	remove_listener: function(type, fn) {
		if(!this._listeners[type]) return;
		for(var i = this._listeners[type].length;i--;) {
			if(this._listeners[type][i] == fn) {
				this._listeners[type][i].splice(i, 1);
				break;
			}
		}
	},
	
	load_playlist: function(list, fn) {
		var PER_PAGE = 50;
		var self = this;
		var buff = [ ];
		var page = 0;
		this.load_playlist_page(list, page, PER_PAGE, function(entries, total_cnt, page_cnt) {
			if(!entries) page = -1;
			else {
				for(var i = 0;i < entries.length;i++) buff.push(entries[i]);
				if(total_cnt <= page * PER_PAGE) page = -1;
				else page++;
			}
			if(page == -1) fn(buff);
			else self.load_playlist_page(list, page, PER_PAGE, arguments.callee);
		});
	},
	
	load_playlist_page: function(list, page, per_page, fn) {
		YTPL.DataAPI.call('feeds/api/playlists/'+list+'?v=2&max-results='+per_page+'&start-index='+(page*per_page+1), function(success, xml) {
			var use_namespace = xml.getElementsByTagName('openSearch:totalResults').length > 0;
			fn(
				success ? xml.getElementsByTagName('entry') : null,
				success ? xml.getElementsByTagName((use_namespace?'openSearch:':'')+'totalResults')[0].textContent : null, 
				success ? xml.getElementsByTagName((use_namespace?'openSearch:':'')+'itemsPerPage')[0].textContent : null
			);
		});
	},
	
	from_xml: function(xml) {
		var entries = [ ];
		var use_namespace = xml.length && xml[0].getElementsByTagName('media:group').length > 0;
		for(var i = 0, len = xml.length;i < len;i++) {
			try {
				entries.push(this.serialize_video({
					video_id: 
						xml[i]	
						.getElementsByTagName((use_namespace?'media:':'')+'group')[0]
						.getElementsByTagName((use_namespace?'yt:':'')+'videoid')[0]
						.textContent,
					title: 
						xml[i]
						.getElementsByTagName((use_namespace?'media:':'')+'group')[0]
						.getElementsByTagName((use_namespace?'media:':'')+'title')[0]
						.textContent,
					author: 
						xml[i]
						.getElementsByTagName('author')[0]
						.getElementsByTagName('name')[0]
						.textContent,
					thumbnail: 
						xml[i]
						.getElementsByTagName((use_namespace?'media:':'')+'group')[0]
						.getElementsByTagName((use_namespace?'media:':'')+'thumbnail')[0]
						.getAttribute('url')
				}));
			} catch(e) { }
		}
		return entries;
	},
	
	append_to_playlist: function(videos) {
		var base_count = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector).length;
		var html = [ ];
		for(var i = 0, len = videos.length;i < len;i++) {
			var o = this.unserialize_video(videos[i])
			o.count = base_count + i + 1;
			html.push(YTPL.HTML.fill(YTPL.HTML.video, o));
		}
		this._playlist_selector.innerHTML += html.join('');
		this._playlist_selector.appendChild(YTPL.HTML.get_by_class('ytpl-spinner', this._playlist_selector));
		YTPL.HTML.get_by_class('ytpl-spinner', this._playlist_selector).style.display = 'none';
		
		var height = 0;
		var items = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		for(var i = items.length;i--;) {
			items[i].onclick = YTPL.Util.bind(this._on_video_click, this, items[i]);
			height += items[i].offsetHeight;
		}
		if(height < this._playlist_selector.offsetHeight) {
			YTPL.HTML.remove_class(this._playlist_selector, 'ytpl-h');
		} else if(!YTPL.HTML.has_class(this._playlist_selector, 'ytpl-h')) {
			YTPL.HTML.add_class(this._playlist_selector, 'ytpl-h');
		}
	},
	
	mark_playing: function(v) {
		var CLASS_NAME = 'ytpl-playing';
		var videos = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		for(var i = videos.length;i--;) {
			if(videos[i].id == v) {
				YTPL.HTML.add_class(videos[i], CLASS_NAME);
				YTPL.HTML.get_by_class('count', videos[i]).innerHTML = '&#9654;';
			} else if(YTPL.HTML.has_class(videos[i], CLASS_NAME)) {
				YTPL.HTML.remove_class(videos[i], CLASS_NAME);
				YTPL.HTML.get_by_class('count', videos[i]).innerHTML = videos[i].getAttribute('data-cnt');
			}
		}
	},
	
	cue: function(v) {
		if(this._player) {
			this._player.cueVideoById(v);
		} else {
			var self = this;
			this._when_player_ready = function() {
				self.cue(v);
				self._when_player_ready = null;
			};
		}
	},
	
	play: function(v) {
		this._opts.video_id = v;
		this.cue(this._opts.video_id);
		this.mark_playing(this._opts.video_id);
		this._set_nav();
	},
	
	play_next: function() {
		var videos = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		var b = null;
		var next = null;
		for(var i = 0, len = videos.length;i <  len;i++) {
			if(videos[i].id == this._opts.video_id) {
				next = b || videos[videos.length-1];
				break;
			}
			b = videos[i];
		}
		next = next || videos[0];
		this.play(next.id);
	},
	
	play_previous: function() {
		var videos = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		var b = null;
		var prev = null;
		for(var i = videos.length;i--;) {
			if(videos[i].id == this._opts.video_id) {
				prev = b || videos[0];
				break;
			}
			b = videos[i];
		}
		prev = prev || videos[videos.length-1];
		this.play(prev.id);
	},
	
	shuffle_seed: function() {
		return 100 + Math.floor(Math.random()*899);
	},
	
	shuffle: function(seed) {
		var videos = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		var len = videos.length;
		seed = ''+seed;
		for(var i = 0;i < seed.length;i++) {
			var jump = seed.charAt(i)*1;
			var sub_jump = Math.ceil(jump * 1.25);
			var swaps = 0;
			var j = 0;
			while(swaps++ < len) {
				j = ((j+jump) % len);
				var k = (j+sub_jump) % len;
				var tmp = videos[j];
				videos[j] = videos[k];
				videos[k] = tmp;
			}
		}
		for(var i = len;i--;) this._playlist_selector.appendChild(videos[i]);
		this._playlist_selector.appendChild(YTPL.HTML.get_by_class('ytpl-spinner', this._playlist_selector));
	},
	
	unshuffle: function() {
		var videos = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		var len = videos.length;
		var order = [ ];
		for(var i = 0;i < len;i++) {
			order[videos[i].getAttribute('data-cnt')-1] = videos[i];
		}
		for(var i = 0;i < len;i++) this._playlist_selector.appendChild(order[i]);
		this._playlist_selector.appendChild(YTPL.HTML.get_by_class('ytpl-spinner', this._playlist_selector));
	},
	
	get_video: function(i) {
		var videos = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		if(videos.length) {
			if(i < 0) i = videos.length + i;
			var video = videos[i];
		} else {
			var video = videos;
		}
		return {
			video_id: video.getAttribute('id'),
			title: video.getAttribute('data-title'),
			author: video.getAttribute('data-author'),
			thumbnail: video.getAttribute('data-thumb')
		};
	},
	
	serialize: function() {
		var data = [ ];
		var videos = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector);
		for(var i = 0, len = videos.length;i < len;i++) {
			var v = videos[i];
			data[v.getAttribute('data-cnt')-1] = this.serialize_video({
				video_id: v.getAttribute('id'),
				title: v.getAttribute('data-title'),
				author: v.getAttribute('data-author'),
				thumbnail: v.getAttribute('data-thumb')
			});
		}
		return data;
	},
	
	serialize_video: function(video) {
		return [ 
			'video_id='+encodeURIComponent(video.video_id),
			'title='+encodeURIComponent(video.title),
			'author='+encodeURIComponent(video.author),
			'thumbnail='+encodeURIComponent(video.thumbnail)
		].join('&');
	},
	
	unserialize_video: function(s) {
		var parts = s.split('&');
		var o = { };
		for(var i = parts.length;i--;) {
			var sub_parts = parts[i].split('=', 2);
			o[sub_parts[0]] = decodeURIComponent(sub_parts[1]);
		}
		return o;
	},
	
	_activate_nav: function() {
		var self = this;
		
		if(this._opts.autoplay) {
			YTPL.HTML.add_class(YTPL.HTML.get_by_class('ytpl-autoplay', this._selector), 'selected');
		}
		YTPL.HTML.get_by_class('ytpl-autoplay', this._selector).onclick = function() {
			self._opts.autoplay = !self._opts.autoplay;
			if(self._opts.autoplay) {
				YTPL.HTML.add_class(this, 'selected');
			} else {
				YTPL.HTML.remove_class(this, 'selected');
			}
			self._notify(YTPL.AUTOPLAY, {autoplay: self._opts.autoplay});
		};
		
		if(this._opts.shuffle) {
			YTPL.HTML.add_class(YTPL.HTML.get_by_class('ytpl-shuffle', this._selector), 'selected');
		}
		YTPL.HTML.get_by_class('ytpl-shuffle', this._selector).onclick = function() {
			if(self._opts.shuffle) {
				YTPL.HTML.remove_class(this, 'selected');
				self._opts.shuffle = false;
				self.unshuffle();
			} else {
				YTPL.HTML.add_class(this, 'selected');
				self._opts.shuffle = self.shuffle_seed();
				self.shuffle(self._opts.shuffle);
			}
			self._scroll_to_playing();
			self._notify(YTPL.SHUFFLE, {shuffle: self._opts.shuffle});
		};
		
		YTPL.HTML.get_by_class('ytpl-left-nav', this._selector).onclick = function() {
			self.play_previous();
			self._scroll_to_playing();
			var video = YTPL.HTML.get_by_class('ytpl-playing', self._selector);
			self._notify_video_selected(video);
		};
		YTPL.HTML.get_by_class('ytpl-right-nav', this._selector).onclick = function() {
			self.play_next();
			self._scroll_to_playing();
			var video = YTPL.HTML.get_by_class('ytpl-playing', self._selector);
			self._notify_video_selected(video);
		};
	},
	
	_notify: function(type, obj) {
		obj = obj || { };
		if(!this._listeners[type]) return;
		for(var i = 0;i < this._listeners[type].length;i++) {
			this._listeners[type][i](obj);
		}
	},
	
	_notify_video_selected: function(video) {
		this._notify(YTPL.VIDEO_SELECTED, {
			video_id: video.getAttribute('id'),
			title: video.getAttribute('data-title'),
			author: video.getAttribute('data-author'),
			thumbnail: video.getAttribute('data-thumb')
		});
	},
	
	_on_video_click: function(evt, video) {
		if(video === undefined) video = evt;
		this.play(video.getAttribute('id'));
		this._notify_video_selected(video);
	},
	
	_on_playlist_load: function(list) {		 
		this.append_to_playlist(list);
		if(!this._opts.video_id) {
			this._opts.video_id = this.get_video(-1).video_id;
			this.cue(this._opts.video_id);
		}
		this.mark_playing(this._opts.video_id);
		if(this._opts.shuffle) {
			this.shuffle(this._opts.shuffle);
			this._scroll_to_playing();
		}
		this._set_nav();
	},
	
	_set_nav: function(playing, total) {
		if(playing === undefined) {
			playing = YTPL.HTML.get_by_class('ytpl-playing', this._selector).getAttribute('data-cnt');
		}
		if(total === undefined)  {
			total = YTPL.HTML.get_by_class('ytpl-pl-vid', this._playlist_selector).length;
		}
		YTPL.HTML.get_by_class('ytpl-summary', this._selector).innerHTML = playing+'/'+total;
	},
	
	_load_player_api: function() {
		YTPL.PlayerAPI.add_listener(YTPL.Util.bind(this._on_player_api_load, this));
		YTPL.PlayerAPI.load();
	},
	
	_on_player_api_load: function() {
		this._create_player();
	},
	
	_create_player: function() {
		var opts = { };
		if(this._opts.video_id) opts.videoId = this._opts.video_id;
		this._player =  new YT.Player('ytpl-'+this._id+'-player', YTPL.Util.extend(opts, {
			width: this._opts.playerw,
			height: this._opts.playerh,
			events: { 
				onReady: YTPL.Util.bind(this._on_player_ready, this),
				onStateChange: YTPL.Util.bind(this._on_player_statechange, this)
			}
		}));
	},
	
	_scroll_to_playing: function() {
		this._playlist_selector.scrollTop = YTPL.HTML.get_by_class('ytpl-playing', this._playlist_selector).offsetTop;
	},
	
	_on_player_ready: function(evt) {
		this._when_player_ready && this._when_player_ready();
		if(this._opts.autoplay) this._player.playVideo();
		this._notify(YTPL.PLAYER_READY);
	},
	
	_on_player_statechange: function(evt) {
		if(evt.data == YT.PlayerState.CUED) {
			if(this._opts.autoplay) this._player.playVideo();
		} else if(evt.data == YT.PlayerState.ENDED) {
			if(this._opts.autoplay) this.play_next();
		} else if(evt.data == YT.PlayerState.PLAYING) {
			this._slider && this._slider.slide();
		}
	}
};

YTPL.Slider = function(selector) {
	this._fps = 1000 / 24;
	this._on = false;
	this._finished = false;
	this._x = 0;
	this._time = 0;
	this._total_time = 0;
	this._run_time = 1000;
	this._ease = null;
	this._enterframe_interval =  null;
	this._selector = selector;
	this._width = this._selector.offsetWidth;
};

YTPL.Slider.prototype = {
	
	turn_on: function(run_time, ease) {
		this._on = true;
		this._run_time = run_time;
		this._x = (-1 * this._width);
		this._selector.style.left = this._x + 'px';
		this._ease = this['_ease_'+ease] || this._ease_linear;
	},
	
	slide: function() {
		if(!this._on || this._finished) return;
		this._finished = true;
		this._time = +new Date();
		this._enterframe_interval = setInterval(YTPL.Util.bind(this._on_enterframe, this), this._fps);
	},
	
	_ease_linear: function(p, interval) {
		this._x = -1 * (this._width - p * this._width);
	},
	
	_ease_sin: function(p, interval) {
		this._x = -1 * (this._width - Math.sin(p * (Math.PI / 2)) * this._width);
	},
	
	_ease_bounce: function(p, interval) {
		if (p < (1/2.75)) {
			this._x = -1 * (this._width - this._width*(7.5625*p*p));
		} else if (p < (2/2.75)) {
			this._x = -1 * (this._width - this._width*(7.5625*(p-=(1.5/2.75))*p + .75));
		} else if (p < (2.5/2.75)) {
			this._x = -1 * (this._width - this._width*(7.5625*(p-=(2.25/2.75))*p + .9375));
		} else {
			this._x = -1 * (this._width - this._width*(7.5625*(p-=(2.625/2.75))*p + .984375));
		}
	},
	
	_ease_elastic: function(p, interval) {
		var s=1.70158;var d=0;var a=this._width;
		if (p==0) {
			this._x = -1 * this._width;
		} else if (p==1) {
			this._x = 0;
		} else {
			if (!d) d=interval*.3;
			d=interval*.3;
			if (a < Math.abs(this._width)) { a=this._width; var s=d/4; }
			else var s = d/(2*Math.PI) * Math.asin (this._width/a);
			this._x = (this._width - (a*Math.pow(2,-10*p) * Math.sin( (p*interval-s)*(2*Math.PI)/d ) + this._width));
		}
	},
	
	_on_enterframe: function() {
		var now = +new Date();
		var interval = now - this._time;
		this._time = now;
		this._total_time = Math.min(this._run_time, this._total_time + interval);
		
		this._ease(this._total_time / this._run_time, interval);
		
		if(this._total_time == this._run_time) {
			this._x = 0;
			clearInterval(this._enterframe_interval)
		} 
		
		this._selector.style.left = this._x + 'px';
	}
};

YTPL.HTML = {
	module: ' \
<div id="ytpl-{{ id }}" class="ytpl"> \
	<div class="ytpl-col ytpl-col-left"> \
		<div id="ytpl-{{ id }}-player"> \
		</div> \
	</div> \
	<div class="ytpl-col ytpl-col-right"> \
		<div class="ytpl-pl-slider"> \
			<div class="ytpl-qnav"> \
				<div class="ytpl-sprite ytpl-left ytpl-btn ytpl-left-nav"></div> \
				<div class="ytpl-summary"></div> \
				<div class="ytpl-sprite ytpl-right ytpl-btn ytpl-right-nav"></div> \
			</div> \
			<div class="ytpl-qopts"> \
				<a class="ytpl-autoplay-opt" title="Autoplay"><div class="ytpl-sprite ytpl-btn ytpl-autoplay"></div></a> \
				<a class="ytpl-shuffle-opt" title="Shuffle"><div class="ytpl-sprite ytpl-btn ytpl-shuffle"></div></a> \
			</div> \
			<ol id="ytpl-{{ id }}-pl" class="ytpl-pl ytpl-h"> \
				<li class="ytpl-spinner"></li> \
			</ol> \
		</div> \
	</div> \
</div> \
',
	video: ' \
	<li id="{{ video_id }}" class="ytpl-pl-vid" title="{{ title }}" data-cnt="{{ count }}" data-title="{{ title }}" data-thumb="{{ thumbnail }}" data-author="{{ author }}"> \
		<span class="ytpl-a"> \
			<span class="ytpl-stat ytpl-cnt">{{ count }}</span> \
			<span class="ytpl-thumb-wrap"> \
				<span class="ytpl-thumb"> \
					<span> \
						<span class="ytpl-thumb-inner"> \
							<img alt="" src="{{ thumbnail }}" width="64"> \
							<span class="ytpl-v-align"></span> \
						</span> \
					</span> \
				</span> \
			</span> \
			<span class="ytpl-title">{{ title }}</span> \
			<span class="ytpl-stat ytpl-att"> \
			by {{ author }} \
			</span> \
		</span> \
	</li> \
',

	get_by_class: function(class_name, parent) {
		if(typeof parent === 'string') parent = document.getElementById(parent);
		var children = (parent || document).getElementsByTagName('*');
		var elements = [];
		for(var i = children.length;i--;) (' '+children[i].className+' ').indexOf(' '+class_name+' ') > -1 && elements.push(children[i]);
		return elements.length == 1 ? elements[0] : elements;
	},
	
	add_class: function(element, class_name) {
		var class_names_add = class_name.split(/\s+/)
		var class_names_current = element.className.split(/\s+/);
		for(var i = class_names_add.length;i--;) 
			class_names_current.indexOf(class_names_add[i]) == -1 && class_names_current.push(class_names_add[i]);
		element.className = class_names_current.join(' ');
	},
	
	remove_class: function(element, class_name) {
		var class_names_remove = class_name.split(/\s+/)
		var class_names_current = element.className.split(/\s+/);
		var index = 0;
		for(var i = class_names_remove.length;i--;) 
			(index = class_names_current.indexOf(class_names_remove[i])) != -1 && class_names_current.splice(index, 1);
		element.className = class_names_current.join(' ');
	},
	
	has_class: function(element, class_name) { 
		return element.className.indexOf(class_name) != -1; 
	},
	
	fill: function(template, params) {
		for(var p in params) template = template.replace(new RegExp('{{\\s*'+p+'\\s*}}', 'g'), params[p]);
		return template;
	}
};

YTPL.Util = {
	
	protocol: location.protocol == 'file:' ? 'http:' : location.protocol,
	
	bind: function(fn, o) {
		var args = Array.prototype.slice.call(arguments, 2);
		return function() { fn.apply(o, Array.prototype.slice.call(arguments, 0).concat(args)); };
	},
	
	extend: function(a, b) {
		var c = { };
		for(var p in a) c[p] = a[p];
		for(var p in b) if(c[p] === undefined) c[p] = b[p];
		return c;
	}
};

YTPL.DataAPI = {
	
	URI: 'gdata.youtube.com',
	
	call: function yt_api(query, callback) {
		var xhr;  
		if(window.XMLHttpRequest) {
			xhr = new XMLHttpRequest();  
		} else if(window.ActiveXObject) {
			var versions = 
				['Microsoft.XmlHttp','MSXML2.XmlHttp.2.0','MSXML2.XmlHttp.3.0','MSXML2.XmlHttp.4.0','MSXML2.XmlHttp.5.0'];
			for(var i = versions.length;i--;) {  
				try {  
					xhr = new ActiveXObject(versions[i]);  
					break;  
				} catch(e) { }
			}
		}
		if(!xhr) {
			callback && callback(false);
			return;
		}
		xhr.onreadystatechange = function() {
			if(xhr.readyState != 4) return;  
			callback && callback(xhr.status == 200, xhr.responseXML);
		};  
		xhr.open('GET', YTPL.Util.protocol+'//'+YTPL.DataAPI.URI+'/'+query, true);  
		xhr.send();  
	} 
};

YTPL.PlayerAPI = {

	URI: 'www.youtube.com/iframe_api',

	_on_ready_buff: null,
	
	_listeners: [ ],
	
	_loaded: false,
	
	add_listener: function(fn) {
		this._listeners.push(fn);
	},
	
	remove_listener: function(fn) {
		var i = this._listeners.indexOf(fn);
		i != -1 && this._listeners.splice(i, 1);
	},
	
	load: function() {
		if(this._loaded) {
			this._on_load();
			return;
		}
		var s = document.createElement('script');
		s.type = 'text/javascript';
		s.src = YTPL.Util.protocol+'//'+YTPL.PlayerAPI.URI;
		if(window.onYouTubeIframeAPIReady) {
			this._on_ready_buff = window.onYouTubeIframeAPIReady;
		}
		window.onYouTubeIframeAPIReady = YTPL.Util.bind(this._on_load, this);
		document.getElementsByTagName('head')[0].appendChild(s);
	},
	
	_on_load: function() {
		this._loaded = true;
		if(this._on_ready_buff) {
			window.onYouTubeIframeAPIReady = this._on_ready_buff;
			this._on_ready_buff();
			this._on_ready_buff = null;
		}
		for(var i = this._listeners.length;i--;) this._listeners[i]();
		this._listeners = [ ];
	}
};