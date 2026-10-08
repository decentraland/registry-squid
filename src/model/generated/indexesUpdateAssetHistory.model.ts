import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, Index as Index_} from "@subsquid/typeorm-store"
import {IndexUpdateEventType} from "./_indexUpdateEventType"

@Entity_()
export class IndexesUpdateAssetHistory {
    constructor(props?: Partial<IndexesUpdateAssetHistory>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    newIndex!: bigint

    @Index_("idx_indexes_update_asset_history_signer_d807a727")
    @StringColumn_({nullable: false})
    signer!: string

    @BigIntColumn_({nullable: false})
    tokenId!: bigint

    @StringColumn_({nullable: false})
    contractAddress!: string

    @Column_("varchar", {length: 6, nullable: false})
    type!: IndexUpdateEventType
}
