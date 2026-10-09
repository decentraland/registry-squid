import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, ManyToOne as ManyToOne_, Relation as Relation_, StringColumn as StringColumn_, BooleanColumn as BooleanColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {ThirdParty} from "./thirdParty.model"

@Index_("idx_third_party_root_history_third_party_block_number_6734f344", ["thirdParty", "blockNumber"], {unique: false})
@Entity_()
export class ThirdPartyRootHistory {
    constructor(props?: Partial<ThirdPartyRootHistory>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @ManyToOne_(() => ThirdParty, {nullable: true})
    thirdParty!: Relation_<ThirdParty>

    @StringColumn_({nullable: false})
    root!: string

    @BooleanColumn_({nullable: false})
    isApproved!: boolean

    @StringColumn_({nullable: false})
    eventName!: string

    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    transactionHash!: string
}
