import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BytesColumn as BytesColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Parcel} from "./parcel.model"
import {Estate} from "./estate.model"

@Entity_()
export class Operator {
    constructor(props?: Partial<Operator>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BytesColumn_({nullable: true})
    address!: Uint8Array | undefined | null

    @Index_("idx_operator_parcel_3e4e0701")
    @ManyToOne_(() => Parcel, {nullable: true})
    parcel!: Relation_<Parcel> | undefined | null

    @Index_("idx_operator_estate_256ff686")
    @ManyToOne_(() => Estate, {nullable: true})
    estate!: Relation_<Estate> | undefined | null

    @StringColumn_({nullable: false})
    eventName!: string

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @StringColumn_({nullable: false})
    transactionHash!: string
}
