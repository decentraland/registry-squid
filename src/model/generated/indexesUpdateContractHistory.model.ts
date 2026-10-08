import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, BytesColumn as BytesColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class IndexesUpdateContractHistory {
    constructor(props?: Partial<IndexesUpdateContractHistory>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    newIndex!: bigint

    @BytesColumn_({nullable: false})
    contractAddress!: Uint8Array
}
