import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, BigIntColumn as BigIntColumn_, ManyToOne as ManyToOne_, Relation as Relation_, OneToMany as OneToMany_, BytesColumn as BytesColumn_, OneToOne as OneToOne_, JoinColumn as JoinColumn_} from "@subsquid/typeorm-store"
import {Wallet} from "./wallet.model"
import {Owner} from "./owner.model"
import {Operator} from "./operator.model"
import {UpdateOperator} from "./updateOperator.model"
import {Estate} from "./estate.model"
import {EstateHistory} from "./estateHistory.model"
import {Data} from "./data.model"

@Index_("idx_parcel_x_y_42af7888", ["x", "y"], {unique: false})
@Entity_()
export class Parcel {
    constructor(props?: Partial<Parcel>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_("idx_parcel_token_id_2b9a60e5")
    @BigIntColumn_({nullable: false})
    tokenId!: bigint

    @BigIntColumn_({nullable: false})
    x!: bigint

    @BigIntColumn_({nullable: false})
    y!: bigint

    @Index_("idx_parcel_owner_a16bdd5f")
    @ManyToOne_(() => Wallet, {nullable: true})
    owner!: Relation_<Wallet> | undefined | null

    @OneToMany_(() => Owner, e => e.parcel)
    owners!: Relation_<Owner[]>

    @OneToMany_(() => Operator, e => e.parcel)
    operators!: Relation_<Operator[]>

    @BytesColumn_({nullable: true})
    operator!: Uint8Array | undefined | null

    @Index_("idx_parcel_update_operator_564410bc")
    @BytesColumn_({nullable: true})
    updateOperator!: Uint8Array | undefined | null

    @OneToMany_(() => UpdateOperator, e => e.parcel)
    updateOperators!: Relation_<UpdateOperator[]>

    @Index_("idx_parcel_estate_e45d93f0")
    @ManyToOne_(() => Estate, {nullable: true})
    estate!: Relation_<Estate> | undefined | null

    @OneToMany_(() => EstateHistory, e => e.parcel)
    estates!: Relation_<EstateHistory[]>

    @Index_("idx_parcel_data_020cfde4", {unique: true})
    @OneToOne_(() => Data, {nullable: true})
    @JoinColumn_()
    data!: Relation_<Data> | undefined | null

    @BigIntColumn_({nullable: true})
    updatedAt!: bigint | undefined | null
}
