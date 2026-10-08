import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, StringColumn as StringColumn_, BytesColumn as BytesColumn_, ManyToOne as ManyToOne_, Relation as Relation_, BooleanColumn as BooleanColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Wallet} from "./wallet.model"

@Index_("idx_authorization_owner_type_b807efb4", ["owner", "type"], {unique: false})
@Entity_()
export class Authorization {
    constructor(props?: Partial<Authorization>) {
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

    @Index_("idx_authorization_operator_bca26b5d")
    @BytesColumn_({nullable: false})
    operator!: Uint8Array

    @BooleanColumn_({nullable: false})
    isApproved!: boolean

    @BigIntColumn_({nullable: false})
    timestamp!: bigint

    @BigIntColumn_({nullable: false})
    createdAt!: bigint

    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @StringColumn_({nullable: false})
    transactionHash!: string
}
