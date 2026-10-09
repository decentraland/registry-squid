import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class ThirdPartyCount {
    constructor(props?: Partial<ThirdPartyCount>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    thirdPartyTotal!: bigint

    @BigIntColumn_({nullable: false})
    receiptTotal!: bigint

    @BigIntColumn_({nullable: false})
    curationTotal!: bigint
}
