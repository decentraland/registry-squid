import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, Index as Index_} from "@subsquid/typeorm-store"

@Entity_()
export class IndexesUpdateSignerHistory {
    constructor(props?: Partial<IndexesUpdateSignerHistory>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    newIndex!: bigint

    @Index_("idx_indexes_update_signer_history_signer_3f0f1d75")
    @StringColumn_({nullable: false})
    signer!: string
}
