import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, ManyToOne as ManyToOne_, Relation as Relation_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Parcel} from "./parcel.model"

@Entity_()
export class EstateHistory {
    constructor(props?: Partial<EstateHistory>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: true})
    prevEstateId!: string | undefined | null

    @Index_("idx_estate_history_estate_id_462e1c5e")
    @StringColumn_({nullable: true})
    estateId!: string | undefined | null

    @Index_("idx_estate_history_parcel_4e6380b8")
    @ManyToOne_(() => Parcel, {nullable: true})
    parcel!: Relation_<Parcel>

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @Index_("idx_estate_history_estate_token_id_463be587")
    @StringColumn_({nullable: false})
    estateTokenId!: string

    @StringColumn_({nullable: false})
    eventName!: string

    @Index_("idx_estate_history_block_number_659ed9e6")
    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @StringColumn_({nullable: false})
    transactionHash!: string
}
