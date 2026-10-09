import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, Index as Index_, StringColumn as StringColumn_, ManyToOne as ManyToOne_, Relation as Relation_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {IndexUpdateType} from "./_indexUpdateType"
import {IndexesUpdateContractHistory} from "./indexesUpdateContractHistory.model"
import {IndexesUpdateSignerHistory} from "./indexesUpdateSignerHistory.model"
import {IndexesUpdateAssetHistory} from "./indexesUpdateAssetHistory.model"

@Entity_()
export class IndexesUpdateHistory {
    constructor(props?: Partial<IndexesUpdateHistory>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("varchar", {length: 8, nullable: false})
    type!: IndexUpdateType

    @Index_("idx_indexes_update_history_date_78665e18")
    @BigIntColumn_({nullable: false})
    date!: bigint

    @StringColumn_({nullable: false})
    sender!: string

    @Index_("idx_indexes_update_history_contract_update_80ab8217")
    @ManyToOne_(() => IndexesUpdateContractHistory, {nullable: true})
    contractUpdate!: Relation_<IndexesUpdateContractHistory> | undefined | null

    @Index_("idx_indexes_update_history_singer_update_fc4958dc")
    @ManyToOne_(() => IndexesUpdateSignerHistory, {nullable: true})
    singerUpdate!: Relation_<IndexesUpdateSignerHistory> | undefined | null

    @Index_("idx_indexes_update_history_asset_update_fa135478")
    @ManyToOne_(() => IndexesUpdateAssetHistory, {nullable: true})
    assetUpdate!: Relation_<IndexesUpdateAssetHistory> | undefined | null

    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @StringColumn_({nullable: false})
    transactionHash!: string
}
