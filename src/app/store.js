import Vue from 'vue';
import Vuex from "vuex";

import config from "../config";

import * as mutationTypes from '../scripts/mutation-types';
import * as actionTypes from '../scripts/action-types';

import { loadLocale } from './i18n';
import { getRecommendedTrack, generateLayout, fetchData } from "../scripts/utils";

import Status from "./Status";
import PlayerStatus from "./PlayerStatus";
import Player from "./Player";
import PlayerController from "./PlayerController";
import TrackError from "./TrackError";
import TrackInfo from "./TrackInfo";
import PlaybackSource from "./PlaybackSource";
import Artist from "./Artist";
import Track from "./Track";
import Queue from "./Queue";
import Source from "./source/Source";
import SourceGroup from './source/SourceGroup';
import TrackQueue from './queue/TrackQueue';
import RandomTrackQueue from './queue/RandomTrackQueue';
import TrackList from "./source/TrackList";
import Background from './visualization/visual_controllers/Background';
import Visualizer from './visualization/visual_controllers/Visualizer';

Vue.use(Vuex);

const locale = localStorage.getItem('kaiplayerlocale') || window.navigator.language || 'en-US';
const storedPreference = localStorage.getItem("kaiplayerpreference");
const preference = storedPreference ? JSON.parse(storedPreference) : config.defaultPreference;

const playerController = new PlayerController;

playerController.player = new Player;
playerController.preference = preference;

let onProgress;

const playerModule = {
    state: {
        playerController,

        get playing() {
            return this.playerController.status === PlayerStatus.Playing
                || this.playerController.status === PlayerStatus.Streaming;
        },

        progress: 0,
        _updateVisualiztionTrigger: false,
    },
    mutations: {
        [mutationTypes.UPDATE_PROGRESS](state, progress) {
            state.playerController.progress = progress;
        },

        [mutationTypes.UPDATE_PROGRESS_STATE](state, progress) {
            state.progress = progress;
        },

        [mutationTypes.STOP_PLAYBACK](state) {
            if (state.playerController.status !== PlayerStatus.Unloaded) {
                state.playerController.stop();
            }

            state._updateVisualiztionTrigger = true;
            state._updateVisualiztionTrigger = false;
        },

        [mutationTypes.PAUSE_PLAYBACK](state) {
            state.playerController.pause();

            const progress = state.progress;

            state.progress = 0;
            state.progress = progress;
            state._updateVisualiztionTrigger = true;
            state._updateVisualiztionTrigger = false;
        }
    },
    actions: {
        async [actionTypes.INIT_PLAYER_MODULE]({ dispatch }) {
            dispatch(actionTypes.REGISTER_ON_PROGRESS_HANDLER);
        },

        [actionTypes.REGISTER_ON_PROGRESS_HANDLER]({ commit, state }) {
            if (!onProgress) {
                onProgress = (soundId, seek) => {
                    if (typeof seek === "number") {
                        commit(mutationTypes.UPDATE_PROGRESS_STATE, seek);
                    }
                };
            }

            state.playerController.player.off("progress", onProgress);
            state.playerController.player.on("progress", onProgress);
        },

        async [actionTypes.PLAY_TRACK]({ dispatch, commit, state, rootState, rootState: { queueModule : { queueGroup, playingQueueIndex } }, rootGetters: { sources } }, { index = queueGroup.get(playingQueueIndex).activeIndex, queueIndex = playingQueueIndex }) {
            const queue = queueGroup.get(queueIndex);
            const track = queue.get(index);

            if (track) {
                commit(mutationTypes.STOP_PLAYBACK);
                commit(mutationTypes.UPDATE_PLAYING_QUEUE_INDEX, queueIndex);
                commit(mutationTypes.UPDATE_PROGRESS, 0);
                commit(mutationTypes.UPDATE_PROGRESS_STATE, 0);

                const nextTrackPromise = () => {
                    if (queue.constructor === RandomTrackQueue) {
                        return getRecommendedTrack(track, sources && sources.filter(source => source.active));
                    }
                };

                try {
                    await playerController.playTrack(track);
                } catch(e) {
                    console.log(e);

                    if (queue.constructor === RandomTrackQueue) {
                        commit(mutationTypes.ADD_TRACK, { track: await nextTrackPromise });
                    }

                    dispatch(actionTypes.PLAY_TRACK, { index: commit(mutationTypes.NEXT_TRACK) });
                }

                if (rootState.visualizationModule._visualizer.activeType === "random") {
                    commit(mutationTypes.UPDATE_ACTIVE_VISUALIZER_TYPE, "random");
                }
            }
        },

        async [actionTypes.STOP_PLAYBACK]({ dispatch, commit }) {
            commit(mutationTypes.STOP_PLAYBACK);
            commit(mutationTypes.UPDATE_PROGRESS, 0);
            commit(mutationTypes.UPDATE_PROGRESS_STATE, 0);

            (async () => {
                await dispatch(actionTypes.TRIGGER_BACKGROUND_EVENT, "stop");
                await dispatch(actionTypes.TRIGGER_BACKGROUND_EVENT, "reset");
            })();
        },

        [actionTypes.RESUME_PLAYBACK]({ state }) {
            if (state.playerController.player.status !== PlayerStatus.Unloaded) {
                state.playerController.player.play();
            }
        },
    }
};

const generalModule = {
    state: {
        activePanel: {
            index: null,
            lock: false
        },
        mode: null,
        layout: null,
        backgroundImage: localStorage.getItem('kaiplayerbackgroundimage') || 'http://bubblesoft.oss-ap-southeast-1.aliyuncs.com/1d69083104fb0c7d0e3a568d72f3eff8_numendil-333089-unsplash.jpg',
        showSourceIcon: (() => {
            const showSourceIcon = localStorage.getItem('kaiplayershowsouceicon');

            return showSourceIcon ? Boolean(+showSourceIcon) : true;
        })(),
        locale,
        preference,
        showTips: !JSON.parse(localStorage.getItem("kaiplayerinitiated")),
    },

    mutations: {
        [mutationTypes.UPDATE_ACTIVE_PANEL_INDEX] (state, index) {
            state.activePanel.index = index;
        },
        [mutationTypes.SET_ACTIVE_PANEL_INDEX_LOCK] (state, boolean) {
            state.activePanel.lock = boolean;
        },
        [mutationTypes.SET_MODE] (state, mode) {
            state.mode = mode;
        },
        [mutationTypes.LOAD_LAYOUT] (state, layout) {
            state.layout = layout;
        },
        [mutationTypes.SAVE_LAYOUT] (state, { index, layout }) {
            state.layout[index] = layout;
        },
        [mutationTypes.SET_BACKGROUND_IMAGE] (state, url) {
            state.backgroundImage = url;
            localStorage.setItem('kaiplayerbackgroundimage', url);
        },
        [mutationTypes.SET_LOCALE] (state, locale) {
            loadLocale(locale);
            state.locale = locale;
            localStorage.setItem('kaiplayerlocale', locale);
        },
        [mutationTypes.SET_SHOW_SOURCE_ICON] (state, showSourceIcon) {
            state.showSourceIcon = showSourceIcon;
            localStorage.setItem('kaiplayershowsouceicon', Number(showSourceIcon));
        },
        [mutationTypes.SET_SHOW_TIPS] (state, showTips) {
            state.showTips = showTips;
        },
    },
    actions: {
        [actionTypes.INIT] () {
            localStorage.setItem("kaiplayerinitiated", JSON.stringify(true));
        },
        loadLayout({ commit, state }, { mode = state.mode }) {
            const layoutData = localStorage.getItem('kaiplayerlayout' + mode);

            if (layoutData) {
                commit(mutationTypes.LOAD_LAYOUT, JSON.parse(layoutData));
            } else {
                const viewportWidth = window.innerWidth,
                    viewportHeight = window.innerHeight - document.querySelector('#control-bar').offsetHeight;

                commit(mutationTypes.LOAD_LAYOUT, generateLayout(mode, viewportWidth, viewportHeight));
            }
        },
        saveLayout({ commit, state }, { index, layout }) {
            commit(mutationTypes.SAVE_LAYOUT, { index, layout });
            localStorage.setItem('kaiplayerlayout' + state.mode, JSON.stringify(state.layout));
        },
        [actionTypes.CLOSE_TIPS] ({ commit }) {
            commit(mutationTypes.SET_SHOW_TIPS, false);
        }
    }
};

const sourceGroup = new SourceGroup({ name: "Global" });

const sourceModule = {
    state: {
        sourceGroup,
    },
    getters: {
        sources: (state) => state.sourceGroup.get(),
    },
    mutations: {
        [mutationTypes.ADD_SOURCES] (state, sources) {
            state.sourceGroup.add(sources);
            playerController.sources = state.sourceGroup.get();
        },
        [mutationTypes.UPDATE_SOURCE] (state, { index, active }) {
            if (typeof active !== "undefined") {
                state.sourceGroup.get(index).active = active;

                localStorage.setItem("kaiplayersourceactive", JSON.stringify((() => {
                    const data = {};

                    state.sourceGroup.get().forEach(source => {
                        data[source.id] = source.active;
                    });

                    return data;
                })()));
            }

            const sourceGroup = state.sourceGroup;

            state.sourceGroup = null;
            state.sourceGroup = sourceGroup;
        }
    },
    actions: {
        async [actionTypes.FETCH_SOURCES] ({ dispatch, commit }) {
            try {
                const sourcesData = await Promise.all(await fetchData("/audio/sources"));

                const sources = sourcesData.map((sourceData, i) => {
                    const source = new Source(sourceData.id, {
                        name: sourceData.name,
                        icons: sourceData.icons,
                    });

                    const sourceActiveMap = JSON.parse(localStorage.getItem("kaiplayersourceactive")) || { hearthis: false };

                    if (sourceActiveMap.hasOwnProperty(sourceData.id)) {
                        source.active = sourceActiveMap[sourceData.id];
                    } else {
                        source.active = true;
                    }

                    source.priority = (() => {
                        if (sourcesData.length === 1) {
                            return 1;
                        }

                        return (1 - i / sourcesData.length);
                    })();

                    return source;
                });

                commit(mutationTypes.ADD_SOURCES, sources);
                dispatch(actionTypes.UPDATE_TRACK_SOURCE);

                try {
                    const listsDataSet = await fetchData("/audio/lists", { body: sources.map((source) => ({ source: source.id })) });

                    if (listsDataSet) {
                        listsDataSet.forEach((listsData, i) => {
                            if (!listsData) {
                                return;
                            }

                            listsData.forEach((listData) => sources[i].add(new TrackList(listData.id, listData.name, sources[i])));
                        });

                        commit(mutationTypes.UPDATE_SOURCE, sources);
                    }
                } catch (e) {
                    console.log(e);
                }

                return sources;
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return await dispatch(actionTypes.FETCH_SOURCES);
            }
        }
    }
};

const saveQueueData = (queueGroup, playingQueueIndex) => {
    localStorage.setItem('kaiplayerplayingqueues', JSON.stringify({
        queues: queueGroup.get().map(queue => {
            return {
                type: (() => {
                    switch (queue.constructor) {
                        case RandomTrackQueue:
                            return 'random';

                        case TrackQueue:
                        default:
                            return 'basic';
                    }
                })(),
                name: queue.name,
                tracks: queue.get().map(track => ({
                    id: track.id,
                    name: track.name,
                    source: track.source.id,
                    artists: track.artists.map(artist => ({ name: artist.name })),
                    duration: track.duration,
                    playbackSources: track.playbackSources.length ? track.playbackSources
                        .filter((playbackSource) => playbackSource.proxied)
                        .map((playbackSource) => ({
                            urls: playbackSource.urls,
                            quality: playbackSource.quality,
                            proxied: playbackSource.proxied,
                        })) : undefined,
                    picture: track.picture,
                    status: track.status.id,
                    messages: track.messages && Array.from(track.messages).map((message) => ({
                        level: ((message) => {
                            if (message instanceof TrackError) {
                                return "error";
                            } else {
                                return "unknown";
                            }
                        })(message),
                        code: message.code,
                    })),
                    altPlaybackSources: track.altPlaybackSources.length ? track.altPlaybackSources
                        .filter((altPlaybackSource) => {
                            debugger;
                            return altPlaybackSource.playbackSource.proxied;
                        })
                        .map((altPlaybackSource) => ({
                            playbackSource: {
                                urls: altPlaybackSource.playbackSource.urls,
                                quality: altPlaybackSource.playbackSource.quality,
                                proxied: altPlaybackSource.playbackSource.proxied,
                            },
                            similarity: altPlaybackSource.similarity,
                        })) : undefined,
                })),
                activeIndex: queue.activeIndex
            }
        }),
        activeIndex: queueGroup.activeIndex,
        playingQueueIndex,
    }));
};

const restoreQueueData = () => {
    const queueGroup = new Queue();

    let playingQueueIndex = null;

    const queueGroupData = JSON.parse(localStorage.getItem('kaiplayerplayingqueues'));

    if (queueGroupData && queueGroupData.queues.length) {
        queueGroup.add(queueGroupData.queues.map((queueData) => {
            const queue = (() => {
                switch (queueData.type) {
                    case 'random':
                        return new RandomTrackQueue({ name: queueData.name });

                    case 'basic':
                    default:
                        return new TrackQueue({ name: queueData.name });
                }
            })();

            queue.activeIndex = queueData.activeIndex;

            if (queueData.tracks.length) {
                queue.add(queueData.tracks.map((trackData) => new Track(trackData.id, trackData.name, new Source(trackData.source, { name: trackData.source }), {
                    artists: trackData.artists.map(artistData => new Artist({ name: artistData.name })),
                    duration: trackData.duration,
                    picture: trackData.picture,
                    playbackSources: trackData.playbackSources && trackData.playbackSources.length ? trackData.playbackSources
                        .map((playbackSource) => playbackSource.urls && playbackSource.urls.length && new PlaybackSource(playbackSource.urls, playbackSource.quality, playbackSource.proxied))
                        .filter((playbackSource) => playbackSource) : undefined,
                    status: Status.fromId(trackData.status),
                    messages: trackData.messages && trackData.messages.map((messageData) => {
                        if (messageData.level === "error") {
                            return TrackError.fromCode(messageData.code);
                        }

                        return TrackInfo.fromCode(messageData.code);
                    }),
                    altPlaybackSources: trackData.altPlaybackSources && trackData.altPlaybackSources.length ? trackData.altPlaybackSources.map(({ playbackSource, similarity }) => {
                        if (!playbackSource.urls || !playbackSource.urls.length) {
                            return;
                        }

                        return {
                            playbackSource: new PlaybackSource(playbackSource.urls, playbackSource.quality, playbackSource.proxied),
                            similarity,
                        };
                    }).filter((altPlaybackSource) => altPlaybackSource) : [],
                })));
            }

            return queue;
        }));

        queueGroup.activeIndex = queueGroupData.activeIndex;
        playingQueueIndex = queueGroupData.playingQueueIndex || 0;
    }

    return {
        queueGroup,
        playingQueueIndex,
    }
};

const queueModule = {
    state: {
        queueGroup: new Queue(),
        playingQueueIndex: 0,
    },
    mutations: {
        [mutationTypes.UPDATE_QUEUE_GROUP](state, { queues, activeIndex }) {
            queues && state.queueGroup.load(queues);

            if (typeof activeIndex === 'number') {
                state.queueGroup.activeIndex = activeIndex;
            }

            saveQueueData(state.queueGroup, state.playingQueueIndex);
        },

        [mutationTypes.INSERT_QUEUE](state, { index, queue }) {
            state.queueGroup.insert(index, queue);
            saveQueueData(state.queueGroup, state.playingQueueIndex);
        },

        [mutationTypes.UPDATE_QUEUE](state, { index, name, tracks, activeIndex }) {
            const queue = state.queueGroup.get(index);

            name && (queue.name = name);
            tracks && queue.load(tracks);

            if (typeof activeIndex === "number" || activeIndex === null) {
                queue.activeIndex = activeIndex;
            }

            saveQueueData(state.queueGroup, state.playingQueueIndex);
        },

        [mutationTypes.UPDATE_PLAYING_QUEUE_INDEX](state, index) {
            state.playingQueueIndex = index;
            saveQueueData(state.queueGroup, state.playingQueueIndex);
        },

        [mutationTypes.ADD_TRACK](state, { track, queueIndex = state.playingQueueIndex }) {
            const queue = state.queueGroup.get(queueIndex);

            queue.add(track);
            saveQueueData(state.queueGroup, state.playingQueueIndex);
        },

        [mutationTypes.NEXT_TRACK](state, { queueIndex = state.playingQueueIndex } = {}) {
            const queue = state.queueGroup.get(queueIndex);

            return queue.next();
        },

        [mutationTypes.UPDATE_TRACK](state, { index, source, duration, status, messages, queueIndex = state.queueGroup.activeIndex }) {
            const queue = state.queueGroup.get(queueIndex);
            const track = queue.get(index);

            if (source) {
                track.source = source;
            }

            if (duration !== undefined) {
                track.duration = duration;
            }

            if (status) {
                track.status = status;
            }

            if (messages) {
                track.messages = new Set(messages);
            }

            if (duration !== undefined || status || messages) {
                saveQueueData(state.queueGroup, state.playingQueueIndex);
            }
        },

        [mutationTypes.SWITCH_QUEUE_MODE](state, { queue = state.queueGroup.get(state.queueGroup.activeIndex) } = {}) {
            queue.switchMode();
        },
    },
    actions: {
        async [actionTypes.INIT_QUEUE_MODULE]({ commit }) {
            const { queueGroup, playingQueueIndex } = restoreQueueData();

            commit(mutationTypes.UPDATE_PLAYING_QUEUE_INDEX, playingQueueIndex);

            commit(mutationTypes.UPDATE_QUEUE_GROUP, {
                queues: queueGroup.get(),
                activeIndex: queueGroup.activeIndex,
            });
        },

        async [actionTypes.UPDATE_TRACK_SOURCE]({ state, commit, rootState }, { queueIndex, trackIndex } = {}) {
            const sourceMap = (() => {
                const map = {};

                rootState.sourceModule.sourceGroup.get().forEach((source) => {
                    map[source.id] = source;
                });

                return map;
            })();

            const queues = (() => {
                if (typeof queueIndex === "number") {
                    return [state.queueGroup.get(queueIndex)];
                }

                return state.queueGroup.get();
            })();

            queues.forEach((queue, currentQueueIndex) => {
                const tracks = (() => {
                    if (typeof trackIndex === "number" && queue.get(trackIndex)) {
                        return [queue.get(trackIndex)];
                    }

                    return queue.get();
                })();

                tracks.forEach((track, currentIndex) => {
                    commit(mutationTypes.UPDATE_TRACK, {
                        index: currentIndex,
                        queueIndex: currentQueueIndex,
                        source: sourceMap[track.source.id],
                    })
                });
            });
        },
    },
};

const backgroundType = localStorage.getItem('kaisoftbackgroundtype') || 'three',
    visualizerType = localStorage.getItem('kaisoftvisualizertype') || 'random';

const visualizationModule = {
    state: {
        backgroundType,
        visualizerType,
        init: false,
        _background: null,
        _visualizer: null,
        _audioSouce: null
    },
    mutations: {
        [mutationTypes.INIT_VISUALIZATION](state, renderers) {
            state._background = new Background(backgroundType, renderers);
            state._visualizer = new Visualizer(visualizerType, renderers);
            playerModule.state.playerController.visualizer = state._visualizer;
            playerModule.state.playerController.background = state._background;
            state.init = true;
        },

        [mutationTypes.UPDATE_ACTIVE_BACKGROUND_TYPE](state, type) {
            state.backgroundType = type;
            localStorage.setItem('kaisoftbackgroundtype', type);
        },

        [mutationTypes.UPDATE_ACTIVE_VISUALIZER_TYPE](state, type) {
            state.visualizerType = type;
            localStorage.setItem('kaisoftvisualizertype', type);
        },

        [mutationTypes.BACKGROUND_LOAD_RESOURCE](state, { picture } = {}) {
            if (state._background) {
                state._background.loadResource({ picture });
            }
        },

        [mutationTypes.VISUALIZER_LOAD_RESOURCE](state, { picture } = {}) {
            if (state._visualizer) {
                state._visualizer.loadResource({ picture });
            }
        }
    },
    actions: {
        async initVisualization({ commit, state }, mountPoint) {
            const renderers = await import('./visualization/renderers/renderers');

            Object.values(renderers).forEach((renderer) => {
                try {
                    renderer.init(mountPoint);
                } catch (e) { }
            });

            commit(mutationTypes.INIT_VISUALIZATION, renderers);

            const playing = playerModule.state.playing;

            if (playing && state._audioSource) {
                state._visualizer.listen(state._audioSource);
                state._visualizer.activeRenderer.start();
                state._visualizer.start();
                state._visualizer.activeRenderer.show();
            } else if (!playing) {
                state._background.activeRenderer.start();
                state._background.start();
                state._background.activeRenderer.show();
            }

            const queueGroup = queueModule.state.queueGroup,
                queue = queueGroup.get(queueGroup.activeIndex || 0),
                track = queue ? queue.get(queue.activeIndex) : null;

            if (track) {
                commit(mutationTypes.BACKGROUND_LOAD_RESOURCE, { picture: track.picture });
            }
        },

        async [actionTypes.TRIGGER_BACKGROUND_EVENT]({ commit, state }, type) {
            await state._background.event(type);
        }
    }
};

const store = new Vuex.Store({
    modules: {
        playerModule,
        generalModule,
        sourceModule,
        queueModule,
        visualizationModule,
    }
});

let cancelVisualizationChangeBlockedByAnimation = null;
let cancelVisualizationChangeLastMutation = null;
let lastOldState = null;

store._vm.$watch(() => ([
    visualizationModule.state.backgroundType,
    visualizationModule.state.visualizerType,
    playerModule.state.playing,
    playerModule.state._updateVisualiztionTrigger,
]), ([newBackground, newVisualization, newPlaying], oldState) => {
    let [oldBackground, oldVisualization, oldPlaying] = oldState;

    if (cancelVisualizationChangeLastMutation) {
        cancelVisualizationChangeLastMutation();

        if (lastOldState) {
            [oldBackground, oldVisualization, oldPlaying] = lastOldState;
        }
    }

    lastOldState = [oldBackground, oldVisualization, oldPlaying];

    const timeout = setTimeout(async () => {
        cancelVisualizationChangeLastMutation = null;
        lastOldState = null;

        if (newBackground === oldBackground && newVisualization === oldVisualization && newPlaying === oldPlaying) {
            return;
        }

        if (cancelVisualizationChangeBlockedByAnimation) {
            cancelVisualizationChangeBlockedByAnimation();
        }

        const state = visualizationModule.state;

        if (!oldPlaying && state._background.animating) {
            try {
                await new Promise((resolve, reject) => {
                    cancelVisualizationChangeBlockedByAnimation = reject;

                    const unwatch = store._vm.$watch(() => state._background.animating, (animating) => {
                        if (animating) {
                            return;
                        }

                        unwatch();
                        cancelVisualizationChangeBlockedByAnimation = null;
                        resolve();
                    });
                });
            } catch (e) {
                return;
            }
        }

        const background = state._background,
            oldBackgroundRenderer = background.activeRenderer;

        background.activeType = newBackground;

        const newBackgroundRenderer = background.activeRenderer;

        if (newBackground !== oldBackground) {
            if (!newPlaying && !oldPlaying && newBackgroundRenderer !== oldBackgroundRenderer) {
                oldBackgroundRenderer.hide();
                oldBackgroundRenderer.pause();
                newBackgroundRenderer.start();
                newBackgroundRenderer.show();
            }

            state._background = null;
            state._background = background;
        }

        const visualizer = state._visualizer,
            oldVisualizerRenderer = visualizer.activeRenderer;

        visualizer.activeType = newVisualization;

        const newVisualizerRenderer = visualizer.activeRenderer;

        if (newVisualization !== oldVisualization || newVisualization === 'random') {
            if (newPlaying && oldPlaying && newVisualizerRenderer !== oldVisualizerRenderer) {
                oldVisualizerRenderer.hide();
                oldVisualizerRenderer.pause();
                newVisualizerRenderer.start();
                newVisualizerRenderer.show();
            }

            state._visualizer = null;
            state._visualizer = visualizer;
        }

        if (newPlaying !== oldPlaying) {
            if (newPlaying && !oldPlaying) {
                if (oldBackgroundRenderer !== newVisualizerRenderer) {
                    oldBackgroundRenderer.hide();
                    newVisualizerRenderer.start();
                    visualizer.start();
                    newVisualizerRenderer.show();
                    background.stop();
                    oldBackgroundRenderer.pause();
                    background.event('reset');
                } else {
                    background.stop();
                    visualizer.start();
                }
            } else if (!newPlaying && oldPlaying) {
                if (newBackgroundRenderer !== oldVisualizerRenderer) {
                    oldVisualizerRenderer.hide();
                    newBackgroundRenderer.start();
                    background.start();
                    newBackgroundRenderer.show();
                    visualizer.stop();
                    oldVisualizerRenderer.pause();
                } else {
                    visualizer.stop();
                    background.start();
                }
            }
        }
    }, 0);

    cancelVisualizationChangeLastMutation = () => clearTimeout(timeout);
});

export default store;
