/**
 * Created by qhyang on 2017/12/15.
 */

import { timer } from "d3";
import Clubber from 'clubber';

import VisualController from './VisualController';

import '../../../styles/histogram';


export default class Visualizer extends VisualController {
    _random;
    _clubber;

    get types() {
        return [{
            name: 'Random',
            value: 'random'
        }].concat(super.types);
    }

    get activeType() {
        if (this._random) {
            return 'random';
        }

        return super.activeType;
    }

    set activeType(type) {
        if (type === 'random') {
            this._random = true;

            const rendererTypes = Object.keys(this._renderers);

            super.activeType = rendererTypes[Math.floor(rendererTypes.length * Math.random())];
        } else {
            this._random = false;
            super.activeType = type;
        }

        this._picture && this.activeRenderer.renderPicture(this._picture);

        if (this._active) {
            this.stop();
            this.start();
        }
    }

    constructor(type, renderers) {
        const { three, histogram, ribbon, electricArc, artwork } = renderers;

        const _renderers = {
            three,
            histogram,
            // ribbon,
            electricArc,
            artwork,
        };

        for (const key in _renderers) {
            if (!_renderers.hasOwnProperty(key)) {
                continue;
            }

            if (!_renderers[key]) {
                delete _renderers[key];
            }
        }

        if (type === 'random') {
            const rendererTypes = Object.keys(_renderers);

            super(rendererTypes[Math.floor(rendererTypes.length * Math.random())]);
            this._random = true;
        } else {
            super(type);
        }

        this._renderers = _renderers;
        this._active = false;

        this._clubber = new Clubber({
            size: 2048,
            mute: false
        });
    }

    listen(audioSource) {
        this._clubber.listen(audioSource);
    }

    start() {
        if (this._active) {
            return;
        }

        const { artworkRenderer } = this._renderers.artwork;

        if (this.activeRenderer === artworkRenderer) {
            requestAnimationFrame(() => {
                this._active = true;
            });
            return;
        }

        super.start();

        const bandWidth = this.activeRenderer.bandWidth;

        let bands = [];

        for (let i = 0; i < 128 / bandWidth; i++) {
            bands[i] = this._clubber.band({
                template: '01234',
                from: i * bandWidth,
                to: i * bandWidth + bandWidth,
                smooth: [0.1, 0.1, 0.1, 0.1, 0.1]
            });
        }

        let lastElapsed;

        const t = timer((elapsed => {
            if (!this._active) {
                return t.stop();
            }

            this._clubber.update();
            this.activeRenderer.renderAudio(bands, (elapsed - lastElapsed) || 0);
            lastElapsed = elapsed;
        }));

    }
}
