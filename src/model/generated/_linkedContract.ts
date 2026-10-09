import assert from "assert"
import * as marshal from "./marshal"

export class LinkedContract {
    private _id!: string
    private _network!: string
    private _address!: string

    constructor(props?: Partial<Omit<LinkedContract, 'toJSON'>>, json?: any) {
        Object.assign(this, props)
        if (json != null) {
            this._id = marshal.string.fromJSON(json.id)
            this._network = marshal.string.fromJSON(json.network)
            this._address = marshal.string.fromJSON(json.address)
        }
    }

    get id(): string {
        assert(this._id != null, 'uninitialized access')
        return this._id
    }

    set id(value: string) {
        this._id = value
    }

    get network(): string {
        assert(this._network != null, 'uninitialized access')
        return this._network
    }

    set network(value: string) {
        this._network = value
    }

    get address(): string {
        assert(this._address != null, 'uninitialized access')
        return this._address
    }

    set address(value: string) {
        this._address = value
    }

    toJSON(): object {
        return {
            id: this.id,
            network: this.network,
            address: this.address,
        }
    }
}
