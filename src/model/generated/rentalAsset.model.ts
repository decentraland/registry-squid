import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BytesColumn as BytesColumn_, BigIntColumn as BigIntColumn_, Index as Index_, BooleanColumn as BooleanColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class RentalAsset {
    constructor(props?: Partial<RentalAsset>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BytesColumn_({nullable: false})
    contractAddress!: Uint8Array

    @BigIntColumn_({nullable: false})
    tokenId!: bigint

    @Index_("idx_rental_asset_lessor_d9d32e97")
    @BytesColumn_({nullable: true})
    lessor!: Uint8Array | undefined | null

    @BooleanColumn_({nullable: false})
    isClaimed!: boolean

    @BigIntColumn_({nullable: true})
    claimedAt!: bigint | undefined | null
}
