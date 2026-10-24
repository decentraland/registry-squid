import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_} from "@subsquid/typeorm-store"
import {Vesting} from "./vesting.model"

@Entity_()
export class ReleaseLog {
    constructor(props?: Partial<ReleaseLog>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @Index_("idx_release_log_vesting_2f02524e")
    @ManyToOne_(() => Vesting, {nullable: true})
    vesting!: Relation_<Vesting>
}
