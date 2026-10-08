import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BytesColumn as BytesColumn_, OneToMany as OneToMany_, Relation as Relation_} from "@subsquid/typeorm-store"
import {Parcel} from "./parcel.model"
import {Estate} from "./estate.model"

@Entity_()
export class Wallet {
    constructor(props?: Partial<Wallet>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BytesColumn_({nullable: false})
    address!: Uint8Array

    @OneToMany_(() => Parcel, e => e.owner)
    parcels!: Relation_<Parcel[]>

    @OneToMany_(() => Estate, e => e.owner)
    estates!: Relation_<Estate[]>
}
