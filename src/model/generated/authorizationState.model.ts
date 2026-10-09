import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, StringColumn as StringColumn_, BytesColumn as BytesColumn_, ManyToOne as ManyToOne_, Relation as Relation_, BooleanColumn as BooleanColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Wallet} from "./wallet.model"

@Index_("idx_authorization_state_owner_type_f9979f82", ["owner", "type"], {unique: false})
@Entity_()
export class AuthorizationState {
    constructor(props?: Partial<AuthorizationState>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    type!: string

    @BytesColumn_({nullable: false})
    tokenAddress!: Uint8Array

    @ManyToOne_(() => Wallet, {nullable: true})
    owner!: Relation_<Wallet>

    @Index_("idx_authorization_state_operator_7bbcf1b8")
    @BytesColumn_({nullable: false})
    operator!: Uint8Array

    @BooleanColumn_({nullable: false})
    isApproved!: boolean

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number
}
