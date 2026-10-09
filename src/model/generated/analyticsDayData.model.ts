import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class AnalyticsDayData {
    constructor(props?: Partial<AnalyticsDayData>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    date!: number

    @IntColumn_({nullable: false})
    rentals!: number

    @BigIntColumn_({nullable: false})
    volume!: bigint

    @BigIntColumn_({nullable: false})
    lessorEarnings!: bigint

    @BigIntColumn_({nullable: false})
    feeCollectorEarnings!: bigint
}
