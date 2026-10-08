import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToOne as OneToOne_, Relation as Relation_, StringColumn as StringColumn_} from "@subsquid/typeorm-store"
import {Parcel} from "./parcel.model"
import {Estate} from "./estate.model"

@Entity_()
export class Data {
    constructor(props?: Partial<Data>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @OneToOne_(() => Parcel, e => e.data)
    parcel!: Relation_<Parcel> | undefined | null

    @OneToOne_(() => Estate, e => e.data)
    estate!: Relation_<Estate> | undefined | null

    @StringColumn_({nullable: false})
    version!: string

    @StringColumn_({nullable: true})
    name!: string | undefined | null

    @StringColumn_({nullable: true})
    description!: string | undefined | null

    @StringColumn_({nullable: true})
    ipns!: string | undefined | null
}
