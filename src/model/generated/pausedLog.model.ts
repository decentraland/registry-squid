import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_} from "@subsquid/typeorm-store"
import {Vesting} from "./vesting.model"

@Entity_()
export class PausedLog {
    constructor(props?: Partial<PausedLog>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @StringColumn_({nullable: false})
    eventType!: string

    @Index_("idx_paused_log_vesting_3cd287fd")
    @ManyToOne_(() => Vesting, {nullable: true})
    vesting!: Relation_<Vesting>
}
