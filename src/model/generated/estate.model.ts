import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_, OneToMany as OneToMany_, BytesColumn as BytesColumn_, IntColumn as IntColumn_, OneToOne as OneToOne_, JoinColumn as JoinColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
import {Wallet} from "./wallet.model"
import {Owner} from "./owner.model"
import {Operator} from "./operator.model"
import {UpdateOperator} from "./updateOperator.model"
import {Parcel} from "./parcel.model"
import {Data} from "./data.model"

@Entity_()
export class Estate {
    constructor(props?: Partial<Estate>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_("idx_estate_owner_30058568")
    @ManyToOne_(() => Wallet, {nullable: true})
    owner!: Relation_<Wallet>

    @OneToMany_(() => Owner, e => e.estate)
    owners!: Relation_<Owner[]>

    @OneToMany_(() => Operator, e => e.estate)
    operators!: Relation_<Operator[]>

    @BytesColumn_({nullable: true})
    operator!: Uint8Array | undefined | null

    @Index_("idx_estate_update_operator_b588af2f")
    @BytesColumn_({nullable: true})
    updateOperator!: Uint8Array | undefined | null

    @OneToMany_(() => UpdateOperator, e => e.estate)
    updateOperators!: Relation_<UpdateOperator[]>

    @IntColumn_({nullable: true})
    size!: number | undefined | null

    @OneToMany_(() => Parcel, e => e.estate)
    parcels!: Relation_<Parcel[]>

    @Index_("idx_estate_data_8621a487", {unique: true})
    @OneToOne_(() => Data, {nullable: true})
    @JoinColumn_()
    data!: Relation_<Data> | undefined | null

    @BigIntColumn_({nullable: true})
    createdAt!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    updatedAt!: bigint | undefined | null
}
