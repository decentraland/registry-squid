import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, BooleanColumn as BooleanColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class Rental {
    constructor(props?: Partial<Rental>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_("idx_rental_contract_address_3d56a3e3")
    @StringColumn_({nullable: false})
    contractAddress!: string

    @Index_("idx_rental_token_id_bf3e246c")
    @BigIntColumn_({nullable: false})
    tokenId!: bigint

    @Index_("idx_rental_lessor_92effc0e")
    @StringColumn_({nullable: false})
    lessor!: string

    @Index_("idx_rental_tenant_d44886f9")
    @StringColumn_({nullable: false})
    tenant!: string

    @StringColumn_({nullable: false})
    operator!: string

    @BigIntColumn_({nullable: false})
    rentalDays!: bigint

    @Index_("idx_rental_started_at_5918f9fc")
    @BigIntColumn_({nullable: false})
    startedAt!: bigint

    @Index_("idx_rental_ends_at_46f910ef")
    @BigIntColumn_({nullable: false})
    endsAt!: bigint

    @Index_("idx_rental_updated_at_a469c81a")
    @BigIntColumn_({nullable: false})
    updatedAt!: bigint

    @BigIntColumn_({nullable: false})
    pricePerDay!: bigint

    @StringColumn_({nullable: false})
    sender!: string

    @BooleanColumn_({nullable: false})
    ownerHasClaimedAsset!: boolean

    @BigIntColumn_({nullable: true})
    claimedAt!: bigint | undefined | null

    @BooleanColumn_({nullable: false})
    isExtension!: boolean

    @Index_("idx_rental_is_active_030735ed")
    @BooleanColumn_({nullable: false})
    isActive!: boolean

    @Index_("idx_rental_signature_cefde5b9")
    @StringColumn_({nullable: false})
    signature!: string

    @StringColumn_({nullable: false})
    rentalContractAddress!: string

    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @StringColumn_({nullable: false})
    transactionHash!: string
}
