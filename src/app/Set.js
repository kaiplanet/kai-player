/**
 * Created by qhyang on 2017/12/11.
 */

export default class QueueGroup {
    get name() {
        return this._name;
    }

    get length() {
        return this._items.length;
    }

    get active() {
        return this._active;
    }

    set active(index) {
        this._active = index;
    }

    constructor({ name }) {
        this._name = name;
        this._items = [];
        this._active = null;
    }

    /**
     *
     * Add item to the set, return the index of the item.
     *
     * @param item
     * @returns {number}
     */
    add(item) {
        this._items.push(item);

        if (this._items.length === 1) {
            this._active = 0;
        }

        return this.length - 1;
    }

    get(index) {
        if (typeof index === 'number') {
            return this._items[index];
        }

        return this._items;
    }
}
